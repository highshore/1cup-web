"use client";

import { useState } from "react";
import { CheckCircleIcon, LinkIcon, XCircleIcon } from "@heroicons/react/24/outline";

import { useI18n } from "../../../i18n/I18nProvider";
import {
  connectMarketingChannel,
  disconnectMarketingChannel,
} from "../services/growth_service";
import {
  MarketingChannelConnection,
  SOCIAL_MARKETING_CHANNELS,
  SocialMarketingChannel,
} from "../types/growth_types";

const fill = (template: string, values: Record<string, string>) =>
  Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), template);

const buttonClass =
  "inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-[#050505] px-3 py-1.5 text-[12px] font-black text-[#050505] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-solid focus-visible:outline-[3px] focus-visible:outline-[#f47a4a] focus-visible:outline-offset-2";

// Connects Threads and Instagram by pasting a long-lived token. The token is sent once
// to the `marketing` Edge Function, verified against Meta, and never read back.
export default function ChannelConnections({
  connections,
  loadError,
  onChanged,
  channels = SOCIAL_MARKETING_CHANNELS,
}: {
  connections: MarketingChannelConnection[];
  loadError: boolean;
  onChanged: () => Promise<void>;
  // Limit the panel to some channels (the per-channel admin pages show one).
  channels?: SocialMarketingChannel[];
}) {
  const { locale, t } = useI18n();
  const copy = t.admin.marketing.channels;
  const [tokens, setTokens] = useState<Record<SocialMarketingChannel, string>>({ threads: "", instagram: "" });
  const [editing, setEditing] = useState<Record<SocialMarketingChannel, boolean>>({ threads: false, instagram: false });
  const [busy, setBusy] = useState<SocialMarketingChannel | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const dateFormatter = new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    dateStyle: "medium",
    timeZone: "Asia/Seoul",
  });

  const handleConnect = async (channel: SocialMarketingChannel) => {
    const token = tokens[channel].trim();
    if (!token) return;
    setBusy(channel);
    setMessage(null);
    try {
      const result = await connectMarketingChannel(channel, token);
      setTokens((current) => ({ ...current, [channel]: "" }));
      setEditing((current) => ({ ...current, [channel]: false }));
      setMessage({ text: fill(copy.connectSuccess, { channel: copy.names[channel], username: result.username }) });
      await onChanged();
    } catch (error) {
      setMessage({
        text: fill(copy.connectError, { message: error instanceof Error ? error.message : String(error) }),
        error: true,
      });
    } finally {
      setBusy(null);
    }
  };

  const handleDisconnect = async (channel: SocialMarketingChannel) => {
    if (!window.confirm(fill(copy.disconnectConfirm, { channel: copy.names[channel] }))) return;
    setBusy(channel);
    setMessage(null);
    try {
      await disconnectMarketingChannel(channel);
      await onChanged();
    } catch (error) {
      setMessage({
        text: fill(copy.connectError, { message: error instanceof Error ? error.message : String(error) }),
        error: true,
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-2xl border-[3px] border-[#050505] bg-white p-6 shadow-[6px_6px_0_rgba(5,5,5,0.9)] max-[620px]:p-4">
      <h2 className="m-0 flex items-center gap-2 text-[20px] font-black text-[#050505]">
        <LinkIcon width={18} /> {copy.connectionsTitle}
      </h2>
      <p className="mx-0 mt-1.5 mb-4 text-[13px] font-semibold leading-[1.6] text-[rgba(5,5,5,0.64)]">
        {copy.connectionsDescription}
      </p>

      {loadError && <p className="m-0 mb-3 text-[13px] font-bold text-[#b9473f]">{copy.loadError}</p>}

      <div className={`grid gap-3 ${channels.length > 1 ? "grid-cols-2 max-[740px]:grid-cols-1" : "grid-cols-1"}`}>
        {channels.map((channel) => {
          const connection = connections.find((candidate) => candidate.channel === channel);
          const connected = connection?.connected === true;
          const showTokenInput = !connected || editing[channel];
          return (
            <div key={channel} className="grid gap-2.5 rounded-xl border-2 border-[#050505] p-4">
              <div className="flex items-center justify-between gap-2">
                <strong className="text-[15px] font-black text-[#050505]">{copy.names[channel]}</strong>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-black ${
                    connected ? "bg-[#dff6df] text-[#2f6b3f]" : "bg-[#f1efec] text-[#706a64]"
                  }`}
                >
                  {connected ? <CheckCircleIcon width={14} /> : <XCircleIcon width={14} />}
                  {connected ? copy.connected : copy.notConnected}
                </span>
              </div>

              {connected && (
                <div className="grid gap-0.5 text-[13px] font-semibold text-[rgba(5,5,5,0.7)]">
                  {connection?.username && <span className="font-black text-[#050505]">@{connection.username}</span>}
                  {connection?.tokenExpiresAt && (
                    <span>{fill(copy.tokenExpires, { date: dateFormatter.format(connection.tokenExpiresAt) })}</span>
                  )}
                  {connection?.lastError && (
                    <span className="text-[#b9473f]">{fill(copy.lastError, { message: connection.lastError })}</span>
                  )}
                </div>
              )}

              {showTokenInput && (
                <div className="flex gap-2 max-[480px]:flex-col">
                  <input
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    value={tokens[channel]}
                    placeholder={copy.tokenPlaceholder}
                    aria-label={`${copy.names[channel]} ${copy.tokenPlaceholder}`}
                    onChange={(event) => setTokens((current) => ({ ...current, [channel]: event.target.value }))}
                    className="min-h-9 min-w-0 flex-1 rounded-lg border-[1.5px] border-[#050505] px-3 py-1.5 text-[13px] text-[#050505] focus-visible:outline-solid focus-visible:outline-[3px] focus-visible:outline-[#f47a4a]"
                  />
                  <button
                    type="button"
                    className={`${buttonClass} bg-[#f47a4a]`}
                    disabled={busy === channel || !tokens[channel].trim()}
                    onClick={() => void handleConnect(channel)}
                  >
                    {busy === channel ? copy.connecting : copy.connect}
                  </button>
                </div>
              )}

              {connected && (
                <div className="flex flex-wrap gap-2">
                  {!editing[channel] && (
                    <button
                      type="button"
                      className={`${buttonClass} bg-white`}
                      disabled={busy === channel}
                      onClick={() => setEditing((current) => ({ ...current, [channel]: true }))}
                    >
                      {copy.reconnect}
                    </button>
                  )}
                  <button
                    type="button"
                    className={`${buttonClass} bg-white`}
                    disabled={busy === channel}
                    onClick={() => void handleDisconnect(channel)}
                  >
                    {copy.disconnect}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mx-0 mt-3 mb-0 text-[12px] font-semibold leading-[1.6] text-[rgba(5,5,5,0.56)]">{copy.tokenHelp}</p>
      {message && (
        <p className={`mx-0 mt-3 mb-0 text-[13px] font-bold ${message.error ? "text-[#b9473f]" : "text-[#2f6b3f]"}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}
