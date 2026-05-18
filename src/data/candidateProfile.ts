import React from "react";

export type CandidateProfile = {
  name: string;
  avatarLabel: string;
};

export const candidateProfileStorageKey = "arkme-demo.candidateProfile";
export const candidateNameStorageKey = "arkme-demo.candidateName";
export const candidateProfileUpdatedEvent = "arkme-demo:candidate-profile-updated";

function normalizeName(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function buildCandidateAvatarLabel(name: string) {
  const characters = Array.from(name.trim());
  return characters.at(-1) ?? "";
}

export function getCandidateProfile(): CandidateProfile | null {
  if (typeof window === "undefined") return null;

  const storedProfile = window.localStorage.getItem(candidateProfileStorageKey);
  if (storedProfile) {
    try {
      const parsedProfile = JSON.parse(storedProfile) as Partial<CandidateProfile>;
      const name = normalizeName(parsedProfile.name);
      if (name) {
        const avatarLabel =
          normalizeName(parsedProfile.avatarLabel) || buildCandidateAvatarLabel(name);
        return { name, avatarLabel };
      }
    } catch {
      // Fall back to the plain candidate name storage key below.
    }
  }

  const name = normalizeName(window.localStorage.getItem(candidateNameStorageKey));
  if (!name) return null;
  return { name, avatarLabel: buildCandidateAvatarLabel(name) };
}

export function setCandidateProfileName(name: string) {
  if (typeof window === "undefined") return;

  const normalizedName = name.trim();
  if (!normalizedName) {
    window.localStorage.removeItem(candidateProfileStorageKey);
    window.localStorage.removeItem(candidateNameStorageKey);
  } else {
    const profile: CandidateProfile = {
      name: normalizedName,
      avatarLabel: buildCandidateAvatarLabel(normalizedName),
    };
    window.localStorage.setItem(candidateProfileStorageKey, JSON.stringify(profile));
    window.localStorage.setItem(candidateNameStorageKey, normalizedName);
  }

  window.dispatchEvent(new Event(candidateProfileUpdatedEvent));
}

export function useCandidateProfile() {
  const [profile, setProfile] = React.useState<CandidateProfile | null>(
    getCandidateProfile
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const refreshProfile = () => setProfile(getCandidateProfile());
    const handleStorage = (event: StorageEvent) => {
      if (
        event.key !== candidateProfileStorageKey &&
        event.key !== candidateNameStorageKey
      ) {
        return;
      }
      refreshProfile();
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(candidateProfileUpdatedEvent, refreshProfile);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(candidateProfileUpdatedEvent, refreshProfile);
    };
  }, []);

  return profile;
}
