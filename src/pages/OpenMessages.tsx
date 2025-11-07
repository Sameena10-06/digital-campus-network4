import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { GraduationCap, ArrowLeft, MessageSquare, Search } from "lucide-react";
import ChatInterface from "@/components/ChatInterface";

interface Student {
  id: string;
  full_name: string;
  department: string;
  avatar_url: string;
}

interface ChatRoom {
  id: string;
  otherUser: Student;
}

const OpenMessages = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
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
      await loadStudents(user.id);
      await loadChatRooms(user.id);
      
      const roomParam = searchParams.get('room');
      if (roomParam) {
        setSelectedRoom(roomParam);
      }
    };

    init();
  }, [navigate, searchParams]);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredStudents(students);
    } else {
      const filtered = students.filter(student =>
        student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.department.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredStudents(filtered);
    }
  }, [searchQuery, students]);

  const loadStudents = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, department, avatar_url')
      .neq('id', userId)
      .order('full_name');

    if (error) {
      toast({
        title: "Error loading students",
        description: error.message,
        variant: "destructive",
      });
    } else if (data) {
      setStudents(data);
      setFilteredStudents(data);
    }
  };

  const loadChatRooms = async (userId: string) => {
    const { data: participantData } = await supabase
      .from('chat_participants')
      .select(`
        chat_room_id,
        chat_rooms!inner(id, type)
      `)
      .eq('user_id', userId);

    if (participantData) {
      const rooms: ChatRoom[] = [];
      
      for (const participant of participantData) {
        const room = participant.chat_rooms as any;
        if (room.type === 'open') {
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
      }
      
      setChatRooms(rooms);
    }
  };

  const startChat = async (student: Student) => {
    if (!currentUserId) return;

    // Check if chat already exists
    const existingRoom = chatRooms.find(room => room.otherUser.id === student.id);
    if (existingRoom) {
      setSelectedRoom(existingRoom.id);
      return;
    }

    // Create new open chat room
    const { data: newRoom, error: roomError } = await supabase
      .from('chat_rooms')
      .insert({
        type: 'open',
        created_by: currentUserId
      })
      .select()
      .single();

    if (roomError) {
      toast({
        title: "Error creating chat",
        description: roomError.message,
        variant: "destructive",
      });
      return;
    }

    // Add both participants
    const { error: participantError } = await supabase
      .from('chat_participants')
      .insert([
        { chat_room_id: newRoom.id, user_id: currentUserId },
        { chat_room_id: newRoom.id, user_id: student.id }
      ]);

    if (participantError) {
      toast({
        title: "Error adding participants",
        description: participantError.message,
        variant: "destructive",
      });
      return;
    }

    setChatRooms([...chatRooms, { id: newRoom.id, otherUser: student }]);
    setSelectedRoom(newRoom.id);
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
          <Card className="md:col-span-1 flex flex-col">
            <CardHeader>
              <CardTitle>Open Chat</CardTitle>
              <CardDescription>Message any student without connecting</CardDescription>
              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search students..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto">
              {filteredStudents.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {searchQuery ? "No students found" : "No students available"}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredStudents.map((student) => {
                    const hasActiveChat = chatRooms.some(room => room.otherUser.id === student.id);
                    const activeRoom = chatRooms.find(room => room.otherUser.id === student.id);
                    const isSelected = activeRoom && selectedRoom === activeRoom.id;

                    return (
                      <div
                        key={student.id}
                        onClick={() => hasActiveChat && activeRoom ? setSelectedRoom(activeRoom.id) : startChat(student)}
                        className={`p-4 hover:bg-muted/50 transition-colors cursor-pointer border-l-2 ${
                          isSelected ? 'border-primary bg-muted/50' : 'border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={student.avatar_url} />
                            <AvatarFallback>{student.full_name[0]}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <h3 className="font-semibold">{student.full_name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {student.department}
                            </p>
                          </div>
                          {hasActiveChat && (
                            <MessageSquare className="h-4 w-4 text-primary" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            {selectedRoom && currentUserId ? (
              <ChatInterface roomId={selectedRoom} currentUserId={currentUserId} />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Select a student to start messaging
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

export default OpenMessages;
