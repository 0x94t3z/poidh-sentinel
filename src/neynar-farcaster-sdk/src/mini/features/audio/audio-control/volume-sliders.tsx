"use client";

import { useAtom } from "jotai";
import { sfxVolumeAtom, musicVolumeAtom } from "../audio-atoms";
import { Stack, Small, Slider } from "@neynar/ui";

type VolumeSlidersProps = {
  className?: string;
};

export function VolumeSliders({ className = "" }: VolumeSlidersProps) {
  const [sfxVolume, setSfxVolume] = useAtom(sfxVolumeAtom);
  const [musicVolume, setMusicVolume] = useAtom(musicVolumeAtom);

  return (
    <Stack direction="vertical" spacing={3} className={className}>
      {/* SFX Volume */}
      <div className="space-y-2">
        <Small color="muted">Sound Effects</Small>
        <Slider
          defaultValue={[sfxVolume * 100]}
          onValueCommit={(value) => setSfxVolume(value[0] / 100)}
          min={0}
          max={100}
          step={5}
          aria-label="Sound effects volume"
        />
      </div>

      {/* Music Volume */}
      <div className="space-y-2">
        <Small color="muted">Music</Small>
        <Slider
          defaultValue={[musicVolume * 100]}
          onValueCommit={(value) => setMusicVolume(value[0] / 100)}
          min={0}
          max={100}
          step={5}
          aria-label="Music volume"
        />
      </div>
    </Stack>
  );
}
