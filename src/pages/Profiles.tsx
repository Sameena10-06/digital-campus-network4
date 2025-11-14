import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Search, UserPlus, ArrowLeft, MessageSquare } from "lucide-react";
import Logo from "@/assets/logo.JPG";

interface Profile {
  id: string;
  full_name: string;
  email: string;
  department: string;
  bio: string | null;
  soft_skills: string[];
  technical_skills: string[];
  avatar_url: string | null;
  connectionStatus?: 'none' | 'pending' | 'accepted';
}

const Profiles = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [filteredProfiles, setFilteredProfiles] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProfiles = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      setCurrentUserId(user.id);

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', user.id);

      if (error) {
        toast({
          title: "Error loading profiles",
          description: error.message,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Get all connections for current user
      const { data: connections } = await supabase
        .from('connections')
        .select('*')
        .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`);

      // Add connection status to profiles
      const profilesWithStatus = (data || []).map(profile => {
        const connection = connections?.find(
          conn => conn.requester_id === profile.id || conn.receiver_id === profile.id
        );
        
        let connectionStatus: 'none' | 'pending' | 'accepted' = 'none';
        if (connection) {
          connectionStatus = connection.status === 'accepted' ? 'accepted' : 'pending';
        }

        return {
          ...profile,
          connectionStatus
        };
      });

      setProfiles(profilesWithStatus);
      setFilteredProfiles(profilesWithStatus);
      setIsLoading(false);
    };

    fetchProfiles();
  }, [navigate, toast]);

  useEffect(() => {
    const filtered = profiles.filter(profile =>
      profile.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      profile.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      profile.technical_skills.some(skill => 
        skill.toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
    setFilteredProfiles(filtered);
  }, [searchQuery, profiles]);

  const handleConnect = async (profileId: string) => {
    try {
      const { error } = await supabase
        .from('connections')
        .insert({
          requester_id: currentUserId,
          receiver_id: profileId,
        });

      if (error) throw error;

      // Update the UI to show pending status
      setProfiles(prevProfiles => 
        prevProfiles.map(profile => 
          profile.id === profileId 
            ? { ...profile, connectionStatus: 'pending' as const }
            : profile
        )
      );

      toast({
        title: "Connection request sent!",
        description: "You'll be notified when they accept.",
      });
    } catch (error: any) {
      toast({
        title: "Error sending request",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleMessage = async (profileId: string) => {
    if (!currentUserId) return;

    // Find existing direct chat room with this user
    const { data: chatRooms } = await supabase
      .from('chat_participants')
      .select('chat_room_id, chat_rooms!inner(type)')
      .eq('user_id', currentUserId);

    if (chatRooms) {
      for (const room of chatRooms) {
        const { data: participants } = await supabase
          .from('chat_participants')
          .select('user_id')
          .eq('chat_room_id', room.chat_room_id);

        if (participants && participants.length === 2 && 
            participants.some(p => p.user_id === profileId)) {
          navigate(`/direct-messages?room=${room.chat_room_id}`);
          return;
        }
      }
    }

    // If no existing chat room found, create a new one
    const { data: newRoom, error: roomError } = await supabase
      .from('chat_rooms')
      .insert({
        type: 'direct',
        created_by: currentUserId
      })
      .select()
      .single();

    if (roomError || !newRoom) {
      toast({
        title: "Error",
        description: "Failed to create chat room",
        variant: "destructive",
      });
      return;
    }

    // Add both users as participants
    const { error: participantsError } = await supabase
      .from('chat_participants')
      .insert([
        { chat_room_id: newRoom.id, user_id: currentUserId },
        { chat_room_id: newRoom.id, user_id: profileId }
      ]);

    if (participantsError) {
      toast({
        title: "Error",
        description: "Failed to add participants",
        variant: "destructive",
      });
      return;
    }

    navigate(`/direct-messages?room=${newRoom.id}`);
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to="/dashboard" className="flex items-center gap-2">
              <img src={Logo} alt="DCN Logo" className="h-10 w-10 rounded-full object-cover"/>
              <span className="text-xl font-bold">Digital Campus Network</span>
            </Link>
            
            <Link to="/dashboard">
              <Button variant="ghost">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">Discover Students</h1>
          <div className="max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, department, or skills..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading profiles...</p>
          </div>
        ) : filteredProfiles.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No students found matching your search.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProfiles.map((profile) => (
              <Card key={profile.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <Avatar>
                      <AvatarImage src={profile.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {profile.full_name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <CardTitle className="text-lg">{profile.full_name}</CardTitle>
                      <CardDescription>{profile.department}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {profile.bio && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{profile.bio}</p>
                  )}
                  
                  {profile.technical_skills && profile.technical_skills.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold mb-2">Technical Skills</p>
                      <div className="flex flex-wrap gap-1">
                        {profile.technical_skills.slice(0, 3).map((skill, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                        {profile.technical_skills.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{profile.technical_skills.length - 3}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    {profile.connectionStatus === 'accepted' ? (
                      <Badge variant="default" className="w-full justify-center">
                        Connected
                      </Badge>
                    ) : profile.connectionStatus === 'pending' ? (
                      <Badge variant="outline" className="w-full justify-center">
                        Request Pending
                      </Badge>
                    ) : (
                      <Button 
                        className="w-full" 
                        onClick={() => handleConnect(profile.id)}
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Connect
                      </Button>
                    )}
                    <Button 
                      variant="outline"
                      className="w-full" 
                      onClick={() => handleMessage(profile.id)}
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Message
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Profiles;