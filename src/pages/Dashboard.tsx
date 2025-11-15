import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { GraduationCap, Users, MessageSquare, LogOut, User } from "lucide-react";
import Logo from "@/assets/logo.jpg";

interface Profile {
  id: string;
  full_name: string;
  email: string;
  department: string;
  bio: string | null;
  soft_skills: string[];
  technical_skills: string[];
  achievements: string[];
  avatar_url: string | null;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        toast({
          title: "Error loading profile",
          description: error.message,
          variant: "destructive",
        });
      } else {
        setProfile(data);
      }

      // Fetch pending connection requests count
      const { count } = await supabase
        .from('connections')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .eq('status', 'pending');

      setPendingCount(count || 0);
      setIsLoading(false);
    };

    fetchProfile();
  }, [navigate, toast]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logged out",
      description: "See you soon!",
    });
    navigate("/");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Navigation */}
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to="/dashboard" className="flex items-center gap-2">
              <img src={Logo} alt="DCN Logo" className="h-10 w-10 rounded-lg object-cover" />
              <span className="text-xl font-bold">Digital Campus Network</span>
            </Link>
            
            <div className="flex items-center gap-4">
              <Link to="/profiles">
                <Button variant="ghost" size="sm">
                  <Users className="h-4 w-4 mr-2" />
                  Discover Students
                </Button>
              </Link>
              <Link to="/connections">
                <Button variant="ghost" size="sm" className="relative">
                  <Users className="h-4 w-4 mr-2" />
                  Connections
                  {pendingCount > 0 && (
                    <Badge className="ml-2 px-1.5 py-0.5 text-xs" variant="destructive">
                      {pendingCount}
                    </Badge>
                  )}
                </Button>
              </Link>
              <Link to="/campus-chat">
                <Button variant="ghost" size="sm">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Campus Chat
                </Button>
              </Link>
              <Link to="/direct-messages">
                <Button variant="ghost" size="sm">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Connected Chat
                </Button>
              </Link>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8 max-w-6xl">
        <div className="grid md:grid-cols-3 gap-6">
          {/* Profile Card */}
          <Card className="md:col-span-2">
            <CardHeader>
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                    {profile?.full_name.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle>{profile?.full_name}</CardTitle>
                  <CardDescription>{profile?.department}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {profile?.bio && (
                <div>
                  <h3 className="font-semibold mb-2">About</h3>
                  <p className="text-muted-foreground">{profile.bio}</p>
                </div>
              )}

              {profile?.technical_skills && profile.technical_skills.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Technical Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {profile.technical_skills.map((skill, index) => (
                      <Badge key={index} variant="secondary">{skill}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {profile?.soft_skills && profile.soft_skills.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Soft Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {profile.soft_skills.map((skill, index) => (
                      <Badge key={index}>{skill}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {profile?.achievements && profile.achievements.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Achievements</h3>
                  <ul className="space-y-2">
                    {profile.achievements.map((achievement, index) => (
                      <li key={index} className="text-muted-foreground">• {achievement}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link to="/profiles">
                  <Button variant="outline" className="w-full justify-start">
                    <Users className="h-4 w-4 mr-2" />
                    Browse Students
                  </Button>
                </Link>
                <Link to="/campus-chat">
                  <Button variant="outline" className="w-full justify-start">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Campus-Wide Chat
                  </Button>
                </Link>
                <Link to="/direct-messages">
                  <Button variant="outline" className="w-full justify-start">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Connected Students
                  </Button>
                </Link>
                <Link to="/profile-setup">
                  <Button variant="outline" className="w-full justify-start">
                    <User className="h-4 w-4 mr-2" />
                    Edit Profile
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;