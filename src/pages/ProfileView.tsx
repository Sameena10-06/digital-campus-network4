import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { GraduationCap, ArrowLeft, MessageSquare, Award, Briefcase, Heart } from "lucide-react";
import Logo from "@/assets/logo.JPG";

interface Profile {
  id: string;
  full_name: string;
  email: string;
  department: string;
  bio: string;
  avatar_url: string;
  technical_skills: string[];
  soft_skills: string[];
  achievements: string[];
}

const ProfileView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>("");
  const [currentUserId, setCurrentUserId] = useState<string>("");

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      setCurrentUserId(user.id);
      loadProfile(user.id);
    };

    init();
  }, [id, navigate]);

  const loadProfile = async (userId: string) => {
    // Load profile
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (profileError || !profileData) {
      toast({
        title: "Error",
        description: "Failed to load profile",
        variant: "destructive",
      });
      return;
    }

    setProfile(profileData);

    // Check connection status
    const { data: connectionData } = await supabase
      .from('connections')
      .select('status')
      .or(`and(requester_id.eq.${userId},receiver_id.eq.${id}),and(requester_id.eq.${id},receiver_id.eq.${userId})`)
      .maybeSingle();

    if (connectionData) {
      setConnectionStatus(connectionData.status);
    }
  };

  const handleConnect = async () => {
    const { error } = await supabase
      .from('connections')
      .insert({
        requester_id: currentUserId,
        receiver_id: id,
        status: 'pending'
      });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Request Sent",
        description: "Connection request sent successfully",
      });
      setConnectionStatus('pending');
    }
  };

  const handleMessage = async () => {
    // Find the direct chat room with this user
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
            participants.some(p => p.user_id === id)) {
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
        { chat_room_id: newRoom.id, user_id: id }
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

  if (!profile) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to="/dashboard" className="flex items-center gap-2">
             <img src={Logo} alt="DCN Logo" className="h-10 w-10 rounded-full object-cover"/>
              <span className="text-xl font-bold">Digital Campus Network</span>
            </Link>
            
            <Link to="/profiles">
              <Button variant="ghost">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-8 max-w-4xl">
        <Card>
          <CardHeader>
            <div className="flex items-start gap-4">
              <Avatar className="h-24 w-24">
                <AvatarImage src={profile.avatar_url} />
                <AvatarFallback>{profile.full_name[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <CardTitle className="text-3xl mb-2">{profile.full_name}</CardTitle>
                <p className="text-muted-foreground mb-4">{profile.department}</p>
                <div className="flex gap-2">
                  {currentUserId !== id && (
                    <>
                      {connectionStatus === 'accepted' ? (
                        <Badge variant="secondary">Connected</Badge>
                      ) : connectionStatus === 'pending' ? (
                        <Badge variant="outline">Request Pending</Badge>
                      ) : (
                        <Button size="sm" onClick={handleConnect}>
                          <Heart className="h-4 w-4 mr-2" />
                          Connect
                        </Button>
                      )}
                      <Button size="sm" onClick={handleMessage}>
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Message
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {profile.bio && (
              <div>
                <h3 className="font-semibold mb-2">About</h3>
                <p className="text-muted-foreground">{profile.bio}</p>
              </div>
            )}

            {profile.technical_skills && profile.technical_skills.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Technical Skills
                </h3>
                <div className="flex flex-wrap gap-2">
                  {profile.technical_skills.map((skill, index) => (
                    <Badge key={index} variant="secondary">{skill}</Badge>
                  ))}
                </div>
              </div>
            )}

            {profile.soft_skills && profile.soft_skills.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Heart className="h-4 w-4" />
                  Soft Skills
                </h3>
                <div className="flex flex-wrap gap-2">
                  {profile.soft_skills.map((skill, index) => (
                    <Badge key={index} variant="outline">{skill}</Badge>
                  ))}
                </div>
              </div>
            )}

            {profile.achievements && profile.achievements.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  Achievements
                </h3>
                <ul className="space-y-2">
                  {profile.achievements.map((achievement, index) => (
                    <li key={index} className="text-muted-foreground flex items-start gap-2">
                      <span className="text-primary">•</span>
                      {achievement}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProfileView;
