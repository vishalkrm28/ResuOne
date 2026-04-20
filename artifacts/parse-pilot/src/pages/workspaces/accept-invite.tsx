import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Building2, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { acceptInvite } from "@/lib/workspaces-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function AcceptInvitePage() {
  const search = useSearch();
  const [, setLocation] = useLocation();

  const params = new URLSearchParams(search);
  const token = params.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMsg("No invitation token found in this link. Please check the link and try again.");
      return;
    }

    acceptInvite(token)
      .then((result) => {
        setWorkspaceId(result.workspaceId);
        setStatus("success");
      })
      .catch((err: Error) => {
        setErrorMsg(err.message ?? "This invitation link is invalid or has already been used.");
        setStatus("error");
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center space-y-5">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mx-auto">
            <Building2 className="w-7 h-7 text-primary" />
          </div>

          {status === "loading" && (
            <>
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
              <div>
                <h1 className="text-xl font-bold">Accepting invitation…</h1>
                <p className="text-sm text-muted-foreground mt-1">Please wait a moment.</p>
              </div>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto" />
              <div>
                <h1 className="text-xl font-bold">You're in!</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Your invitation has been accepted. You now have access to the workspace.
                </p>
              </div>
              <Button
                className="w-full"
                onClick={() => setLocation(workspaceId ? `/workspaces/${workspaceId}` : "/workspaces")}
              >
                Go to Workspace
              </Button>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle className="w-10 h-10 text-destructive mx-auto" />
              <div>
                <h1 className="text-xl font-bold">Invitation failed</h1>
                <p className="text-sm text-muted-foreground mt-1">{errorMsg}</p>
              </div>
              <Button variant="outline" className="w-full" onClick={() => setLocation("/workspaces")}>
                Go to Workspaces
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
