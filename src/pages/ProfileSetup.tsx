import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { X } from "lucide-react";
import { z } from "zod";

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

const profileSchema = z.object({
  fullName: z.string().trim().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  department: z.string().trim().min(1, "Department is required").max(100, "Department must be less than 100 characters"),
  bio: z.string().max(1000, "Bio must be less than 1000 characters").optional(),
  softSkills: z.array(z.string().max(50)).max(20, "Maximum 20 soft skills allowed"),
  technicalSkills: z.array(z.string().max(50)).max(20, "Maximum 20 technical skills allowed"),
  achievements: z.array(z.string().max(200)).max(20, "Maximum 20 achievements allowed"),
});

const ProfileSetup = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [profileData, setProfileData] = useState({
    fullName: "",
    department: "",
    bio: "",
    softSkills: [] as string[],
    technicalSkills: [] as string[],
    achievements: [] as string[],
    avatarUrl: "",
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");

  const [currentInput, setCurrentInput] = useState({
    softSkill: "",
    technicalSkill: "",
    achievement: "",
  });

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      
      setUserId(user.id);

      // Load existing profile data
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile) {
        setProfileData({
          fullName: profile.full_name || "",
          department: profile.department || "",
          bio: profile.bio || "",
          softSkills: profile.soft_skills || [],
          technicalSkills: profile.technical_skills || [],
          achievements: profile.achievements || [],
          avatarUrl: profile.avatar_url || "",
        });
        setAvatarPreview(profile.avatar_url || "");
      }
    };
    loadProfile();
  }, [navigate]);

  const addSkill = (type: 'soft' | 'technical') => {
    const inputKey = type === 'soft' ? 'softSkill' : 'technicalSkill';
    const dataKey = type === 'soft' ? 'softSkills' : 'technicalSkills';
    
    if (currentInput[inputKey].trim()) {
      if (currentInput[inputKey].length > 50) {
        toast({
          title: "Skill too long",
          description: "Each skill must be less than 50 characters",
          variant: "destructive",
        });
        return;
      }
      if (profileData[dataKey].length >= 20) {
        toast({
          title: "Maximum skills reached",
          description: "You can add up to 20 skills",
          variant: "destructive",
        });
        return;
      }
      setProfileData({
        ...profileData,
        [dataKey]: [...profileData[dataKey], currentInput[inputKey].trim()],
      });
      setCurrentInput({ ...currentInput, [inputKey]: "" });
    }
  };

  const removeSkill = (type: 'soft' | 'technical', index: number) => {
    const dataKey = type === 'soft' ? 'softSkills' : 'technicalSkills';
    setProfileData({
      ...profileData,
      [dataKey]: profileData[dataKey].filter((_, i) => i !== index),
    });
  };

  const addAchievement = () => {
    if (currentInput.achievement.trim()) {
      if (currentInput.achievement.length > 200) {
        toast({
          title: "Achievement too long",
          description: "Each achievement must be less than 200 characters",
          variant: "destructive",
        });
        return;
      }
      if (profileData.achievements.length >= 20) {
        toast({
          title: "Maximum achievements reached",
          description: "You can add up to 20 achievements",
          variant: "destructive",
        });
        return;
      }
      setProfileData({
        ...profileData,
        achievements: [...profileData.achievements, currentInput.achievement.trim()],
      });
      setCurrentInput({ ...currentInput, achievement: "" });
    }
  };

  const removeAchievement = (index: number) => {
    setProfileData({
      ...profileData,
      achievements: profileData.achievements.filter((_, i) => i !== index),
    });
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: "Only JPEG, PNG, GIF, and WebP images are allowed",
          variant: "destructive",
        });
        return;
      }
      
      if (file.size > MAX_IMAGE_SIZE) {
        toast({
          title: "File too large",
          description: `Maximum file size is ${MAX_IMAGE_SIZE / (1024 * 1024)}MB`,
          variant: "destructive",
        });
        return;
      }
      
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validation = profileSchema.safeParse({
        fullName: profileData.fullName,
        department: profileData.department,
        bio: profileData.bio,
        softSkills: profileData.softSkills,
        technicalSkills: profileData.technicalSkills,
        achievements: profileData.achievements,
      });

      if (!validation.success) {
        toast({
          title: "Validation failed",
          description: validation.error.errors[0].message,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      let avatarUrl = profileData.avatarUrl;

      // Upload avatar if a new file is selected
      if (avatarFile && userId) {
        const fileExt = avatarFile.name.split('.').pop();
        const filePath = `${userId}/avatar.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        avatarUrl = publicUrl;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profileData.fullName,
          department: profileData.department,
          bio: profileData.bio,
          soft_skills: profileData.softSkills,
          technical_skills: profileData.technicalSkills,
          achievements: profileData.achievements,
          avatar_url: avatarUrl,
        })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: "Profile updated!",
        description: "Your profile has been saved successfully.",
      });

      navigate("/dashboard");
    } catch (error: any) {
      toast({
        title: "Error updating profile",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Complete Your Profile</CardTitle>
          <CardDescription>Tell us more about yourself to get started</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="avatar">Profile Picture</Label>
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar preview" className="object-cover" />
                  ) : (
                    <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                      {profileData.fullName ? profileData.fullName.charAt(0).toUpperCase() : "U"}
                    </AvatarFallback>
                  )}
                </Avatar>
                <Input
                  id="avatar"
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handleAvatarChange}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                placeholder="Enter your full name"
                value={profileData.fullName}
                onChange={(e) => setProfileData({ ...profileData, fullName: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                placeholder="Enter your department"
                value={profileData.department}
                onChange={(e) => setProfileData({ ...profileData, department: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                placeholder="Tell us about yourself..."
                value={profileData.bio}
                onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label>Soft Skills</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add a soft skill (e.g., Leadership)"
                  value={currentInput.softSkill}
                  onChange={(e) => setCurrentInput({ ...currentInput, softSkill: e.target.value })}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill('soft'))}
                />
                <Button type="button" onClick={() => addSkill('soft')}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {profileData.softSkills.map((skill, index) => (
                  <Badge key={index} variant="secondary">
                    {skill}
                    <X
                      className="ml-1 h-3 w-3 cursor-pointer"
                      onClick={() => removeSkill('soft', index)}
                    />
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Technical Skills</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add a technical skill (e.g., Python)"
                  value={currentInput.technicalSkill}
                  onChange={(e) => setCurrentInput({ ...currentInput, technicalSkill: e.target.value })}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill('technical'))}
                />
                <Button type="button" onClick={() => addSkill('technical')}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {profileData.technicalSkills.map((skill, index) => (
                  <Badge key={index} variant="secondary">
                    {skill}
                    <X
                      className="ml-1 h-3 w-3 cursor-pointer"
                      onClick={() => removeSkill('technical', index)}
                    />
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Achievements</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add an achievement"
                  value={currentInput.achievement}
                  onChange={(e) => setCurrentInput({ ...currentInput, achievement: e.target.value })}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAchievement())}
                />
                <Button type="button" onClick={addAchievement}>Add</Button>
              </div>
              <div className="space-y-2 mt-2">
                {profileData.achievements.map((achievement, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded">
                    <span className="flex-1">{achievement}</span>
                    <X
                      className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-foreground"
                      onClick={() => removeAchievement(index)}
                    />
                  </div>
                ))}
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Saving..." : "Complete Profile"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfileSetup;