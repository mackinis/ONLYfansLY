
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
import EditTestimonialForm from '@/components/EditTestimonialForm';
import type { Testimonial, SiteSettings } from '@/lib/types';
import { useTranslation } from '@/context/I18nContext';

interface EditTestimonialModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  testimonial: Testimonial | null;
  onTestimonialUpdated: () => void; // Callback to refresh list
  siteSettings: SiteSettings; // Pass site settings for media options
}

export default function EditTestimonialModal({
  isOpen,
  onOpenChange,
  testimonial,
  onTestimonialUpdated,
  siteSettings
}: EditTestimonialModalProps) {
  const { t } = useTranslation();

  const handleClose = () => {
    onOpenChange(false);
  };

  if (!testimonial) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-primary/20 shadow-xl">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl text-primary">{t('editTestimonialModal.title')}</DialogTitle>
          <DialogDescription>
            {t('editTestimonialModal.description')}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <EditTestimonialForm
            testimonial={testimonial}
            onSuccessfulEdit={() => {
              onTestimonialUpdated();
              handleClose();
            }}
            siteSettings={siteSettings}
          />
        </div>
        {/* Footer can be part of the form for cancel button if needed, or removed if form handles its own buttons */}
      </DialogContent>
    </Dialog>
  );
}
