"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { Gender, SpanishAccent } from "@/lib/tts/types";

const SPANISH_ACCENTS: Array<{ label: string; value: SpanishAccent }> = [
  { label: "Argentine", value: "argentine" },
  { label: "Colombian", value: "colombian" },
  { label: "Latin American", value: "latin-american" },
  { label: "Mexican", value: "mexican" },
  { label: "Peninsular", value: "peninsular" },
];

interface VoiceFilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showGenderFilter: boolean;
  showSpanishAccentFilter: boolean;
  voiceGender: Gender;
  onVoiceGenderChange: (gender: Gender) => void;
  spanishAccent: SpanishAccent;
  onSpanishAccentChange: (accent: SpanishAccent) => void;
  onConfirm: () => void;
  loading: boolean;
  disabled: boolean;
}

export function VoiceFilterDialog({
  open,
  onOpenChange,
  showGenderFilter,
  showSpanishAccentFilter,
  voiceGender,
  onVoiceGenderChange,
  spanishAccent,
  onSpanishAccentChange,
  onConfirm,
  loading,
  disabled,
}: VoiceFilterDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Read Aloud voice settings</DialogTitle>
          <DialogDescription>
            Choose voice filters before generating speech audio.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {showGenderFilter && (
            <div className="grid gap-2">
              <Label>Gender</Label>
              <RadioGroup
                value={voiceGender}
                onValueChange={(value) => onVoiceGenderChange(value as Gender)}
                className="grid gap-3"
              >
                <label className="flex items-center gap-2 rounded-md border border-border p-2">
                  <RadioGroupItem value="feminine" id="voice-feminine" />
                  <span>Feminine</span>
                </label>
                <label className="flex items-center gap-2 rounded-md border border-border p-2">
                  <RadioGroupItem value="masculine" id="voice-masculine" />
                  <span>Masculine</span>
                </label>
              </RadioGroup>
            </div>
          )}

          {showSpanishAccentFilter && (
            <div className="grid gap-2">
              <Label>Accent</Label>
              <RadioGroup
                value={spanishAccent}
                onValueChange={(value) =>
                  onSpanishAccentChange(value as SpanishAccent)
                }
                className="grid gap-2"
              >
                {SPANISH_ACCENTS.map((accent) => (
                  <label
                    key={accent.value}
                    className="flex items-center gap-2 rounded-md border border-border p-2"
                  >
                    <RadioGroupItem value={accent.value} id={accent.value} />
                    <span>{accent.label}</span>
                  </label>
                ))}
              </RadioGroup>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={disabled}
            className="gap-2"
          >
            {loading && <Spinner className="size-4" aria-hidden="true" />}
            {loading ? "Generating..." : "Start"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
