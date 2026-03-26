import { useLocalAuth } from "@/hooks/use-local-auth";
import { useListApplications } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent } from "@/components/Card";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { Link } from "wouter";
import { Plus, FileText, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";

export default function Dashboard() {
  const { userId } = useLocalAuth();
  
  const { data: applications, isLoading } = useListApplications(
    { userId: userId || "" },
    { query: { enabled: !!userId } }
  );

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-10">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            Applications
          </h1>
          <p className="mt-2 text-muted-foreground text-lg">
            Manage and optimize your tailored CVs.
          </p>
        </div>
        <Link href="/new">
          <Button size="lg" className="gap-2">
            <Plus className="w-5 h-5" />
            New Application
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
        </div>
      ) : applications?.length === 0 ? (
        <Card className="flex flex-col items-center justify-center h-[400px] border-dashed border-2 border-border/60 bg-transparent shadow-none text-center">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
            <FileText className="w-10 h-10 text-primary" />
          </div>
          <h3 className="text-2xl font-bold mb-2">No applications yet</h3>
          <p className="text-muted-foreground max-w-sm mb-8 text-lg">
            Create your first application by uploading your CV and pasting a job description.
          </p>
          <Link href="/new">
            <Button size="lg" className="gap-2">
              <Sparkles className="w-5 h-5" />
              Optimize a CV
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {applications?.map((app, i) => (
            <motion.div
              key={app.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, duration: 0.4 }}
            >
              <Link href={`/applications/${app.id}`}>
                <Card className="group cursor-pointer hover:border-primary/30 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden relative">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-accent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <Badge variant={app.status as any} className="uppercase tracking-wider">
                        {app.status}
                      </Badge>
                      {app.keywordMatchScore !== null && (
                        <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full text-sm font-bold border border-emerald-100">
                          <span>{app.keywordMatchScore}%</span>
                          <span className="text-xs font-medium opacity-80">Match</span>
                        </div>
                      )}
                    </div>
                    
                    <h3 className="text-xl font-bold mb-1 group-hover:text-primary transition-colors line-clamp-1">
                      {app.jobTitle}
                    </h3>
                    <p className="text-muted-foreground font-medium mb-6 line-clamp-1">
                      {app.company}
                    </p>
                    
                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/50">
                      <span className="text-sm text-muted-foreground font-medium">
                        {format(new Date(app.createdAt), "MMM d, yyyy")}
                      </span>
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
