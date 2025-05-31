
'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useState, useEffect, useRef } from 'react';

interface LiveStreamModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  remoteStream: MediaStream | null; // Stream from WebRTC
  streamTitle?: string;
}

export default function LiveStreamModal({ isOpen, onOpenChange, remoteStream, streamTitle = "Live Event" }: LiveStreamModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (videoRef.current && remoteStream) {
      videoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, isOpen]);

  if (!isClient) {
    return null; 
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] bg-background border-primary shadow-xl">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl text-primary">{streamTitle}</DialogTitle>
          <DialogDescription>
            You are watching an exclusive live stream from Aurum Media.
          </DialogDescription>
        </DialogHeader>
        <div className="aspect-video bg-black rounded-md my-4 flex items-center justify-center">
          {remoteStream ? (
            <video ref={videoRef} className="w-full h-full" autoPlay playsInline />
          ) : (
            <p className="text-muted-foreground text-lg">Live stream is currently offline or loading...</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

