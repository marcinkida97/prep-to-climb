import { useState } from "react";
import { ServerError } from "@/components/auth/ServerError";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  serverError?: string | null;
}

export function DeleteAccountForm({ serverError }: Props) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <div>
      <ServerError message={serverError} />
      <Button
        type="button"
        variant="destructive"
        className="mt-4"
        onClick={() => {
          setIsDialogOpen(true);
        }}
      >
        Delete account
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This permanently deletes your account and all saved data. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <form method="POST" action="/api/account/delete-account">
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" variant="destructive">
                Delete account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
