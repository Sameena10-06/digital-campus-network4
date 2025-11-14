import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GraduationCap, Users, MessageSquare, Network } from "lucide-react";
import heroImage from "@/assets/campus-hero.jpg";
import Logo from "@/assets/logo.jpg";


const Index = () => {
  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <img src={Logo} alt="DCN Logo" className="h-10 w-10 rounded-full object-cover"/>
              <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Digital Campus Network
              </span>
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

      {/* Hero Section */}
      <section className="relative py-20 px-6 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <img src={heroImage} alt="Campus networking" className="w-full h-full object-cover" />
        </div>
        <div className="container mx-auto max-w-6xl relative z-10">
          <div className="text-center space-y-6">
            <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent leading-tight">
              Connect, Collaborate & Grow
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Join your campus community. Network with fellow students, showcase your skills, and build meaningful connections.
            </p>
            <div className="flex gap-4 justify-center pt-4">
              <Link to="/auth">
                <Button size="lg" className="shadow-lg">
                  Get Started
                </Button>
              </Link>
              <Link to="/about">
                <Button size="lg" variant="outline">
                  Learn More
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-center mb-12">Why Join Us?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-6 rounded-lg bg-card border shadow-sm hover:shadow-md transition-shadow">
              <Users className="h-12 w-12 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">Build Your Network</h3>
              <p className="text-muted-foreground">
                Connect with students across departments, share knowledge, and grow together.
              </p>
            </div>
            
            <div className="p-6 rounded-lg bg-card border shadow-sm hover:shadow-md transition-shadow">
              <Network className="h-12 w-12 text-accent mb-4" />
              <h3 className="text-xl font-semibold mb-2">Showcase Skills</h3>
              <p className="text-muted-foreground">
                Create detailed profiles highlighting your technical skills, achievements, and projects.
              </p>
            </div>
            
            <div className="p-6 rounded-lg bg-card border shadow-sm hover:shadow-md transition-shadow">
              <MessageSquare className="h-12 w-12 text-secondary mb-4" />
              <h3 className="text-xl font-semibold mb-2">Stay Connected</h3>
              <p className="text-muted-foreground">
                Chat with peers, collaborate on projects, and share documents seamlessly.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Connect?</h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join thousands of students already networking on campus.
          </p>
          <Link to="/auth">
            <Button size="lg" className="shadow-lg">
              Create Your Profile
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Index;