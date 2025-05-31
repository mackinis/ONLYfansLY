
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
import TestimonialSubmissionForm from '@/components/TestimonialSubmissionForm';
import { useTranslation } from '@/context/I18nContext';

interface TestimonialModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export default function TestimonialModal({ isOpen, onOpenChange }: TestimonialModalProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-primary/20 shadow-xl">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl text-primary">{t('testimonialModal.title')}</DialogTitle>
          <DialogDescription>
            {t('testimonialModal.description')}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {/* Pass isOpen prop to TestimonialSubmissionForm */}
          <TestimonialSubmissionForm isOpen={isOpen} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('testimonialModal.closeButton')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
