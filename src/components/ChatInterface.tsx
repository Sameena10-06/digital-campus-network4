import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Send, Paperclip, CheckCheck, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { z } from "zod";

const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_MESSAGE_LENGTH = 5000;

const messageSchema = z.object({
  content: z.string().max(MAX_MESSAGE_LENGTH, `Message must be less than ${MAX_MESSAGE_LENGTH} characters`)
});

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  file_url: string | null;
  profiles: {
    full_name: string;
    avatar_url: string;
  };
  reads: Array<{ user_id: string }>;
}

interface TypingUser {
  user_id: string;
  full_name: string;
}

interface ChatInterfaceProps {
  roomId: string;
  currentUserId: string;
  allowFileUpload?: boolean; // Default true, set false for text-only chats
}

const ChatInterface = ({ roomId, currentUserId, allowFileUpload = true }: ChatInterfaceProps) => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    loadMessages();
    subscribeToMessages();
    subscribeToTyping();
  }, [roomId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadMessages = async () => {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        profiles:sender_id(full_name, avatar_url),
        reads:message_reads(user_id)
      `)
      .eq('chat_room_id', roomId)
      .order('created_at', { ascending: true });

    if (error) {
      toast({
        title: "Error loading messages",
        description: error.message,
        variant: "destructive",
      });
    } else if (data) {
      setMessages(data);
      // Mark messages as read
      const unreadMessages = data.filter(
        msg => msg.sender_id !== currentUserId && 
        !msg.reads.some((r: any) => r.user_id === currentUserId)
      );
      
      for (const msg of unreadMessages) {
        await supabase.from('message_reads').insert({
          message_id: msg.id,
          user_id: currentUserId
        });
      }
    }
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel(`messages:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_room_id=eq.${roomId}`
        },
        async (payload) => {
          const { data: newMsg } = await supabase
            .from('messages')
            .select(`
              *,
              profiles:sender_id(full_name, avatar_url),
              reads:message_reads(user_id)
            `)
            .eq('id', payload.new.id)
            .single();

          if (newMsg) {
            setMessages(prev => [...prev, newMsg]);
            
            // Mark as read if not own message
            if (newMsg.sender_id !== currentUserId) {
              await supabase.from('message_reads').insert({
                message_id: newMsg.id,
                user_id: currentUserId
              });
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_reads'
        },
        (payload) => {
          setMessages(prev => prev.map(msg => {
            if (msg.id === payload.new.message_id) {
              return {
                ...msg,
                reads: [...msg.reads, { user_id: payload.new.user_id }]
              };
            }
            return msg;
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const subscribeToTyping = () => {
    const channel = supabase.channel(`typing:${roomId}`, {
      config: { presence: { key: currentUserId } }
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const typing: TypingUser[] = [];
        Object.values(state).forEach((presences: any) => {
          presences.forEach((presence: any) => {
            if (presence.user_id !== currentUserId && presence.typing) {
              typing.push({
                user_id: presence.user_id,
                full_name: presence.full_name
              });
            }
          });
        });
        setTypingUsers(typing);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleTyping = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', currentUserId)
      .single();

    const channel = supabase.channel(`typing:${roomId}`);
    await channel.subscribe();
    await channel.track({
      user_id: currentUserId,
      full_name: profile?.full_name || 'User',
      typing: true
    });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(async () => {
      await channel.track({
        user_id: currentUserId,
        full_name: profile?.full_name || 'User',
        typing: false
      });
    }, 2000);
  };

  const handleSend = async () => {
    console.log('handleSend called', { newMessage, file, roomId, currentUserId });
    
    if (!newMessage.trim() && !file) {
      console.log('No message or file, returning');
      return;
    }

    // Validate message length
    const validation = messageSchema.safeParse({ content: newMessage });
    if (!validation.success) {
      console.log('Validation failed', validation.error);
      toast({
        title: "Invalid message",
        description: validation.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }
    
    console.log('Validation passed, continuing...');

    // Validate file if present
    if (file) {
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: "Only images (JPEG, PNG, GIF, WebP) and PDFs are allowed",
          variant: "destructive",
        });
        return;
      }
      
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: "File too large",
          description: `Maximum file size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
          variant: "destructive",
        });
        return;
      }
    }

    let fileUrl = null;

    if (file) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${currentUserId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('chat-attachments')
        .upload(filePath, file);

      if (uploadError) {
        toast({
          title: "Upload failed",
          description: uploadError.message,
          variant: "destructive",
        });
        return;
      }

      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from('chat-attachments')
        .createSignedUrl(filePath, 3600); // 1 hour expiration

      if (urlError || !signedUrlData?.signedUrl) {
        toast({
          title: "Failed to generate file URL",
          description: urlError?.message || "Unknown error",
          variant: "destructive",
        });
        return;
      }

      fileUrl = signedUrlData.signedUrl;
    }

    console.log('About to insert message', { roomId, currentUserId, content: newMessage, fileUrl });
    
    const { error } = await supabase
      .from('messages')
      .insert({
        chat_room_id: roomId,
        sender_id: currentUserId,
        content: newMessage || (file ? `Shared a file: ${file.name}` : ''),
        file_url: fileUrl
      });

    if (error) {
      console.error('Error inserting message:', error);
      toast({
        title: "Error sending message",
        description: error.message,
        variant: "destructive",
      });
    } else {
      console.log('Message sent successfully');
      setNewMessage("");
      setFile(null);
    }
  };

  const getReadStatus = (message: Message) => {
    if (message.sender_id !== currentUserId) return null;
    
    const readByOthers = message.reads.filter(r => r.user_id !== currentUserId);
    if (readByOthers.length > 0) {
      return <CheckCheck className="h-4 w-4 text-blue-500" />;
    }
    return <Check className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-200px)]">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${
              message.sender_id === currentUserId ? 'flex-row-reverse' : ''
            }`}
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={message.profiles.avatar_url} />
              <AvatarFallback>{message.profiles.full_name[0]}</AvatarFallback>
            </Avatar>
            <div className={`flex flex-col ${message.sender_id === currentUserId ? 'items-end' : ''}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold">{message.profiles.full_name}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                </span>
              </div>
              <div className={`rounded-lg p-3 max-w-md ${
                message.sender_id === currentUserId
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              }`}>
                <p className="break-words">{message.content}</p>
                {message.file_url && (
                  <a
                    href={message.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs underline mt-2 block"
                  >
                    View attachment
                  </a>
                )}
              </div>
              <div className="flex items-center gap-1 mt-1">
                {getReadStatus(message)}
              </div>
            </div>
          </div>
        ))}
        {typingUsers.length > 0 && (
          <div className="text-sm text-muted-foreground italic">
            {typingUsers.map(u => u.full_name).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t p-4">
        {allowFileUpload && file && (
          <div className="mb-2 text-sm text-muted-foreground">
            Selected: {file.name}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFile(null)}
              className="ml-2"
            >
              Remove
            </Button>
          </div>
        )}
        <div className="flex gap-2">
          {allowFileUpload && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
            </>
          )}
          <Input
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              handleTyping();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type a message..."
            className="flex-1"
          />
          <Button onClick={handleSend} type="button">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
