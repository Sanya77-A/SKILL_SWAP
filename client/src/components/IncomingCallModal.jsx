import { Phone, Video } from "lucide-react";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";

export function IncomingCallModal({ open, callerName, isVideo, onAccept, onDecline }) {
  return (
    <Modal open={open} onClose={onDecline} title="Incoming Call">
      <div className="flex flex-col items-center py-6">
        <div className="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center animate-pulse mb-6">
          {isVideo ? (
            <Video className="w-10 h-10 text-accent animate-bounce" />
          ) : (
            <Phone className="w-10 h-10 text-accent animate-bounce" />
          )}
        </div>
        
        <h3 className="text-xl font-heading font-semibold text-text-primary mb-2">
          {callerName || "Someone"}
        </h3>
        <p className="text-text-secondary mb-8">
          is requesting a {isVideo ? "video" : "voice"} call...
        </p>

        <div className="flex gap-4 w-full justify-center">
          <Button 
            onClick={onDecline}
            variant="danger" 
            className="w-32"
          >
            Decline
          </Button>
          <Button 
            onClick={onAccept}
            className="w-32 bg-green-600 hover:bg-green-700 text-white"
          >
            Accept
          </Button>
        </div>
      </div>
    </Modal>
  );
}
