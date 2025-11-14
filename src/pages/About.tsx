import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GraduationCap, Target, Users, Heart } from "lucide-react";
import Logo from "@/assets/logo.jpg";

const About = () => {
  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <img src={Logo} alt="DCN Logo" className="h-10 w-10 rounded-full object-cover"/>
              <span className="text-xl font-bold">Digital Campus Network</span>
            </Link>
            
            <div className="flex items-center gap-6">
              <Link to="/" className="text-sm font-medium hover:text-primary transition-colors">
                Home
              </Link>
              <Link to="/about" className="text-sm font-medium hover:text-primary transition-colors">
                About Us
              </Link>
              <Link to="/auth">
                <Button>Sign Up</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* About Content */}
      <div className="container mx-auto px-6 py-16 max-w-4xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">About Digital Campus Network</h1>
          <p className="text-xl text-muted-foreground">
            Connecting students, fostering collaboration, building futures
          </p>
        </div>

        <div className="space-y-12">
          <section>
            <div className="flex items-center gap-3 mb-4">
              <Target className="h-8 w-8 text-primary" />
              <h2 className="text-2xl font-bold">Our Mission</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Digital Campus Network was created to break down silos in campus life. We believe that 
              meaningful connections between students from different departments, years, and backgrounds 
              lead to better learning experiences, innovative collaborations, and lifelong friendships. 
              Our platform makes it easy to discover peers who share your interests, showcase your skills, 
              and build a professional network that starts on campus.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-3 mb-4">
              <Users className="h-8 w-8 text-accent" />
              <h2 className="text-2xl font-bold">What We Offer</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="p-6 border rounded-lg bg-card">
                <h3 className="font-semibold mb-2">Student Profiles</h3>
                <p className="text-sm text-muted-foreground">
                  Create comprehensive profiles showcasing your skills, achievements, and interests.
                </p>
              </div>
              <div className="p-6 border rounded-lg bg-card">
                <h3 className="font-semibold mb-2">Campus Chat</h3>
                <p className="text-sm text-muted-foreground">
                  Join the open campus conversation and connect with students instantly.
                </p>
              </div>
              <div className="p-6 border rounded-lg bg-card">
                <h3 className="font-semibold mb-2">Direct Messaging</h3>
                <p className="text-sm text-muted-foreground">
                  Send messages and share files with your connections seamlessly.
                </p>
              </div>
              <div className="p-6 border rounded-lg bg-card">
                <h3 className="font-semibold mb-2">Networking</h3>
                <p className="text-sm text-muted-foreground">
                  Build your professional network starting from your campus community.
                </p>
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-3 mb-4">
              <Heart className="h-8 w-8 text-secondary" />
              <h2 className="text-2xl font-bold">Our Values</h2>
            </div>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span><strong>Inclusivity:</strong> Everyone belongs in our community regardless of department or background</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span><strong>Growth:</strong> We believe in continuous learning and mutual support</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span><strong>Privacy:</strong> Your data is yours, and we protect it with care</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span><strong>Collaboration:</strong> Together we achieve more than alone</span>
              </li>
            </ul>
          </section>

          <div className="text-center pt-8">
            <Link to="/auth">
              <Button size="lg">
                Join the Network
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;