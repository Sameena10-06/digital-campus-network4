import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { GraduationCap, ArrowLeft, MessageSquare } from "lucide-react";
import ChatInterface from "@/components/ChatInterface";

interface ChatRoom {
  id: string;
  otherUser: {
    id: string;
    full_name: string;
    department: string;
    avatar_url: string;
  };
}

const DirectMessages = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      setCurrentUserId(user.id);
      await loadChatRooms(user.id);
      
      const roomParam = searchParams.get('room');
      if (roomParam) {
        setSelectedRoom(roomParam);
      }
    };

    init();
  }, [navigate, searchParams]);

  const loadChatRooms = async (userId: string) => {
    // Get all chat rooms where user is a participant and room type is 'direct'
    const { data: participantData, error } = await supabase
      .from('chat_participants')
      .select(`
        chat_room_id,
        chat_rooms!inner(id, type)
      `)
      .eq('user_id', userId);

    if (error) {
      toast({
        title: "Error loading chats",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    if (participantData) {
      const rooms: ChatRoom[] = [];
      
      for (const participant of participantData) {
        // Get the other participant in this room
        const { data: otherParticipants } = await supabase
          .from('chat_participants')
          .select('user_id, profiles:user_id(id, full_name, department, avatar_url)')
          .eq('chat_room_id', participant.chat_room_id)
          .neq('user_id', userId);

        if (otherParticipants && otherParticipants.length > 0) {
          const otherUser = otherParticipants[0].profiles;
          if (otherUser) {
            rooms.push({
              id: participant.chat_room_id,
              otherUser: otherUser as any
            });
          }
        }
      }
      
      setChatRooms(rooms);
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

      <div className="container mx-auto px-6 py-8 max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[calc(100vh-180px)]">
          {/* Chat list */}
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle>Messages</CardTitle>
              <CardDescription>Your direct conversations</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {chatRooms.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">
                    No conversations yet. Connect with students to start messaging!
                  </p>
                  <Link to="/profiles">
                    <Button>Browse Students</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-1">
                  {chatRooms.map((room) => (
                    <div
                      key={room.id}
                      onClick={() => setSelectedRoom(room.id)}
                      className={`p-4 hover:bg-muted/50 transition-colors cursor-pointer border-l-2 ${
                        selectedRoom === room.id ? 'border-primary bg-muted/50' : 'border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={room.otherUser.avatar_url} />
                          <AvatarFallback>{room.otherUser.full_name[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-semibold">{room.otherUser.full_name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {room.otherUser.department}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Chat interface */}
          <Card className="md:col-span-2">
            {selectedRoom && currentUserId ? (
              <ChatInterface roomId={selectedRoom} currentUserId={currentUserId} />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Select a conversation to start messaging
                  </p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DirectMessages;