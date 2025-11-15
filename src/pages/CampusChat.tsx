import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { GraduationCap, ArrowLeft } from "lucide-react";
import ChatInterface from "@/components/ChatInterface";
import Logo from "@/assets/logo.jpg";

const CampusChat = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [campusRoomId, setCampusRoomId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      setCurrentUserId(user.id);
      await initializeCampusChat(user.id);
    };

    init();
  }, [navigate]);

  const initializeCampusChat = async (userId: string) => {
    // Check if campus chat room exists
    const { data: existingRoom } = await supabase
      .from('chat_rooms')
      .select('id')
      .eq('type', 'campus')
      .maybeSingle();

    if (existingRoom) {
      setCampusRoomId(existingRoom.id);
      
      // Check if user is already a participant
      const { data: participant } = await supabase
        .from('chat_participants')
        .select('id')
        .eq('chat_room_id', existingRoom.id)
        .eq('user_id', userId)
        .maybeSingle();

      if (!participant) {
        // Add user as participant
        await supabase
          .from('chat_participants')
          .insert({
            chat_room_id: existingRoom.id,
            user_id: userId
          });
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to="/dashboard" className="flex items-center gap-2">
              <img src={Logo} alt="DCN Logo" className="h-10 w-10 rounded-full object-cover" />
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

      <div className="container mx-auto px-6 py-8 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>Campus Chat</CardTitle>
            <CardDescription>
              Connect with all students on campus in real-time. Share files and have group conversations.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {campusRoomId && currentUserId ? (
              <ChatInterface roomId={campusRoomId} currentUserId={currentUserId} />
            ) : (
              <div className="flex items-center justify-center h-[500px]">
                <p className="text-muted-foreground">Loading chat...</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CampusChat;
