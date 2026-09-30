// Normalisation for the self-authored profile fields on the User: `bio`,
// `instagram` and `telegram`. Pure functions, so updateProfileSchema and the
// tests share one definition of what is stored.
//
// Handles are stored as the bare, lowercased handle (no "@", no URL); both
// networks treat handles case-insensitively. The input may be "@handle", a
// bare handle, or a pasted profile link.

export const BIO_MAX_LENGTH = 80;

export type ProfileFieldResult = { ok: true; value: string | null } | { ok: false; message: string };

type Network = {
    label: string;
    // Hosts whose single-segment path is a profile link, e.g. instagram.com/<h>.
    hosts: string[];
    pattern: RegExp;
    rule: string;
};

const INSTAGRAM: Network = {
    label: "Instagram",
    hosts: ["instagram.com", "www.instagram.com"],
    // 1–30 of [a-z0-9._], no leading, trailing or consecutive dots.
    pattern: /^(?!\.)(?!.*\.\.)(?!.*\.$)[a-z0-9._]{1,30}$/,
    rule: "1–30 letters, numbers, periods or underscores, and cannot start or end with a period or contain two in a row",
};

const TELEGRAM: Network = {
    label: "Telegram",
    hosts: ["t.me", "www.t.me", "telegram.me", "www.telegram.me"],
    // 5–32 of [a-z0-9_], starting with a letter.
    pattern: /^[a-z][a-z0-9_]{4,31}$/,
    rule: "5–32 letters, numbers or underscores, starting with a letter",
};

// "instagram.com/x", "https://www.instagram.com/x/?igsh=…", "t.me/x" …
const LINK_PATTERN = /^(?:https?:\/\/)?([^/?#\s]+)(\/[^?#]*)?(?:[?#].*)?$/i;

const extractHandle = (input: string, network: Network): ProfileFieldResult => {
    const link = LINK_PATTERN.exec(input);
    const host = link?.[1]?.toLowerCase();

    if (link && host && (network.hosts.includes(host) || /^https?:\/\//i.test(input))) {
        if (!network.hosts.includes(host)) {
            return { ok: false, message: `${network.label} must be a handle or a ${network.hosts[0]} profile link` };
        }

        const segments = (link[2] ?? "").split("/").filter(Boolean);

        if (segments.length !== 1) {
            return { ok: false, message: `${network.label} link must point to a profile, like ${network.hosts[0]}/yourname` };
        }

        return { ok: true, value: segments[0]! };
    }

    return { ok: true, value: input };
};

const normalizeHandle = (raw: string | null, network: Network): ProfileFieldResult => {
    if (raw === null) return { ok: true, value: null };

    const trimmed = raw.trim();
    if (trimmed === "") return { ok: true, value: null };

    const extracted = extractHandle(trimmed, network);
    if (!extracted.ok) return extracted;

    const handle = extracted.value!.replace(/^@/, "").toLowerCase();

    if (!network.pattern.test(handle)) {
        return { ok: false, message: `${network.label} handle must be ${network.rule}` };
    }

    return { ok: true, value: handle };
};

export const normalizeInstagram = (raw: string | null) => normalizeHandle(raw, INSTAGRAM);

export const normalizeTelegram = (raw: string | null) => normalizeHandle(raw, TELEGRAM);

export const normalizeBio = (raw: string | null): ProfileFieldResult => {
    if (raw === null) return { ok: true, value: null };

    // A one-line bio: line breaks become a single space.
    const bio = raw.replace(/\s*[\r\n]+\s*/g, " ").trim();
    if (bio === "") return { ok: true, value: null };

    // Count code points, not UTF-16 units, so an emoji counts as one character.
    if (Array.from(bio).length > BIO_MAX_LENGTH) {
        return { ok: false, message: `Bio must be ${BIO_MAX_LENGTH} characters or fewer` };
    }

    return { ok: true, value: bio };
};
