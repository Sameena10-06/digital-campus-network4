import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { GraduationCap, ArrowLeft, Check, X, MessageSquare } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import logo from "@/assets/logo.JPG";

interface ConnectionRequest {
  id: string;
  requester_id: string;
  receiver_id: string;
  status: string;
  created_at: string;
  profile: {
    id: string;
    full_name: string;
    email: string;
    department: string;
    avatar_url: string | null;
  };
}

const Connections = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [receivedRequests, setReceivedRequests] = useState<ConnectionRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<ConnectionRequest[]>([]);
  const [connectedUsers, setConnectedUsers] = useState<ConnectionRequest[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRequests = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      setCurrentUserId(user.id);

      // Fetch received requests
      const { data: received } = await supabase
        .from('connections')
        .select('*')
        .eq('receiver_id', user.id)
        .eq('status', 'pending');

      if (received) {
        const requestsWithProfiles = await Promise.all(
          received.map(async (req) => {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', req.requester_id)
              .single();
            
            return { ...req, profile: profile || {} };
          })
        );
        setReceivedRequests(requestsWithProfiles as any);
      }

      // Fetch sent requests
      const { data: sent } = await supabase
        .from('connections')
        .select('*')
        .eq('requester_id', user.id)
        .eq('status', 'pending');

      if (sent) {
        const requestsWithProfiles = await Promise.all(
          sent.map(async (req) => {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', req.receiver_id)
              .single();
            
            return { ...req, profile: profile || {} };
          })
        );
        setSentRequests(requestsWithProfiles as any);
      }

      // Fetch connected users
      const { data: connected } = await supabase
        .from('connections')
        .select('*')
        .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .eq('status', 'accepted');

      if (connected) {
        const connectionsWithProfiles = await Promise.all(
          connected.map(async (conn) => {
            const otherUserId = conn.requester_id === user.id ? conn.receiver_id : conn.requester_id;
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', otherUserId)
              .single();
            
            return { ...conn, profile: profile || {} };
          })
        );
        setConnectedUsers(connectionsWithProfiles as any);
      }

      setIsLoading(false);
    };

    fetchRequests();
  }, [navigate]);

  const handleAccept = async (connectionId: string) => {
    try {
      const { error } = await supabase
        .from('connections')
        .update({ status: 'accepted' })
        .eq('id', connectionId);

      if (error) throw error;

      toast({
        title: "Connection accepted!",
        description: "You can now message this person.",
      });

      setReceivedRequests(prev => prev.filter(req => req.id !== connectionId));
    } catch (error: any) {
      toast({
        title: "Error accepting connection",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleReject = async (connectionId: string) => {
    try {
      const { error } = await supabase
        .from('connections')
        .update({ status: 'rejected' })
        .eq('id', connectionId);

      if (error) throw error;

      toast({
        title: "Connection rejected",
      });

      setReceivedRequests(prev => prev.filter(req => req.id !== connectionId));
    } catch (error: any) {
      toast({
        title: "Error rejecting connection",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to="/dashboard" className="flex items-center gap-2">
              <GraduationCap className="h-8 w-8 text-primary" />
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
        <h1 className="text-3xl font-bold mb-8">Connection Requests</h1>

        <Tabs defaultValue="connected" className="w-full">
          <TabsList className="grid w-full max-w-2xl grid-cols-3">
            <TabsTrigger value="connected">
              Connected {connectedUsers.length > 0 && `(${connectedUsers.length})`}
            </TabsTrigger>
            <TabsTrigger value="received">
              Received {receivedRequests.length > 0 && `(${receivedRequests.length})`}
            </TabsTrigger>
            <TabsTrigger value="sent">
              Sent {sentRequests.length > 0 && `(${sentRequests.length})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="connected" className="mt-6">
            {isLoading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading connections...</p>
              </div>
            ) : connectedUsers.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No connections yet. Start connecting with students!</p>
                <Link to="/profiles">
                  <Button className="mt-4">Browse Students</Button>
                </Link>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {connectedUsers.map((connection) => (
                  <Card key={connection.id} className="border-primary/20 bg-primary/5">
                    <CardHeader>
                      <div className="flex items-start gap-4">
                        <Avatar className="ring-2 ring-primary/20">
                          <AvatarImage src={connection.profile.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {connection.profile.full_name?.charAt(0) || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <CardTitle className="text-lg">{connection.profile.full_name}</CardTitle>
                          <CardDescription>{connection.profile.department}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Badge variant="default" className="w-full justify-center">
                        Connected
                      </Badge>
                      <Link to={`/profile/${connection.profile.id}`}>
                        <Button variant="outline" className="w-full">
                          View Profile
                        </Button>
                      </Link>
                      <Button 
                        className="w-full" 
                        onClick={() => navigate('/direct-messages')}
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Message
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="received" className="mt-6">
            {isLoading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading requests...</p>
              </div>
            ) : receivedRequests.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No pending connection requests.</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {receivedRequests.map((request) => (
                  <Card key={request.id}>
                    <CardHeader>
                      <div className="flex items-start gap-4">
                        <Avatar>
                          <AvatarImage src={request.profile.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {request.profile.full_name?.charAt(0) || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <CardTitle className="text-lg">{request.profile.full_name}</CardTitle>
                          <CardDescription>{request.profile.department}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex gap-2">
                        <Button 
                          className="flex-1" 
                          onClick={() => handleAccept(request.id)}
                        >
                          <Check className="h-4 w-4 mr-2" />
                          Accept
                        </Button>
                        <Button 
                          variant="outline" 
                          className="flex-1"
                          onClick={() => handleReject(request.id)}
                        >
                          <X className="h-4 w-4 mr-2" />
                          Reject
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="sent" className="mt-6">
            {isLoading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading requests...</p>
              </div>
            ) : sentRequests.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No pending sent requests.</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sentRequests.map((request) => (
                  <Card key={request.id}>
                    <CardHeader>
                      <div className="flex items-start gap-4">
                        <Avatar>
                          <AvatarImage src={request.profile.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {request.profile.full_name?.charAt(0) || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <CardTitle className="text-lg">{request.profile.full_name}</CardTitle>
                          <CardDescription>{request.profile.department}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Badge variant="secondary">Pending</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Connections;
