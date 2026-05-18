import React from "react";
import {
  createTestGroup,
  createTestGroupMessage,
  createTestIdentity,
  createTestMessage,
  getInitialTestGroups,
  getInitialTestIdentities,
  getInitialTestMessages,
  getPrivateConversationId,
  persistTestGroups,
  persistTestIdentities,
  persistTestMessages,
  testConversationStorageEvent,
  testGroupsStorageKey,
  testIdentitiesStorageKey,
  testMessagesStorageKey,
  type TestConversationType,
  type TestGroup,
  type TestIdentity,
  type TestMessage,
} from "@/data/testConversations";
import { formatBubbleTime, formatTimeLabel } from "@/lib/time";
import { cn } from "@/lib/utils";

const adminMessageModeStorageKey = "arkme-demo.adminMessageMode";

function getInitialAdminMessageMode(): TestConversationType {
  if (typeof window === "undefined") return "private";

  const savedMode = window.localStorage.getItem(adminMessageModeStorageKey);
  return savedMode === "group" ? "group" : "private";
}

function persistAdminMessageMode(mode: TestConversationType) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(adminMessageModeStorageKey, mode);
}

function getLatestIdentityMessage(messages: TestMessage[], identityId: string) {
  return messages
    .filter((message) => message.identityId === identityId)
    .reduce<TestMessage | null>((latest, message) => {
      if (!latest || message.sentAt > latest.sentAt) return message;
      return latest;
    }, null);
}

function getLatestConversationMessage(messages: TestMessage[], conversationId: string) {
  return messages
    .filter((message) => message.conversationId === conversationId)
    .reduce<TestMessage | null>((latest, message) => {
      if (!latest || message.sentAt > latest.sentAt) return message;
      return latest;
    }, null);
}

export default function AdminMessageConsole() {
  const [identities, setIdentities] = React.useState(getInitialTestIdentities);
  const [groups, setGroups] = React.useState(getInitialTestGroups);
  const [messages, setMessages] = React.useState(getInitialTestMessages);
  const [activeIdentityId, setActiveIdentityId] = React.useState(
    () => getInitialTestIdentities()[0]?.id ?? ""
  );
  const [activeGroupId, setActiveGroupId] = React.useState(
    () => getInitialTestGroups()[0]?.id ?? ""
  );
  const [messageMode, setMessageMode] =
    React.useState<TestConversationType>(getInitialAdminMessageMode);
  const [showCreateIdentityModal, setShowCreateIdentityModal] = React.useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = React.useState(false);
  const [showIdentityPicker, setShowIdentityPicker] = React.useState(false);
  const [showGroupPicker, setShowGroupPicker] = React.useState(false);
  const [showAdminInfo, setShowAdminInfo] = React.useState(false);
  const [identityName, setIdentityName] = React.useState("");
  const [identityNote, setIdentityNote] = React.useState("");
  const [groupName, setGroupName] = React.useState("");
  const [groupNote, setGroupNote] = React.useState("");
  const [messageText, setMessageText] = React.useState("");
  const [messageTextFocused, setMessageTextFocused] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const identityPickerRef = React.useRef<HTMLDivElement>(null);
  const groupPickerRef = React.useRef<HTMLDivElement>(null);
  const adminInfoRef = React.useRef<HTMLDivElement>(null);

  const activeIdentity =
    identities.find((identity) => identity.id === activeIdentityId) ?? identities[0] ?? null;
  const activeGroup =
    groups.find((group) => group.id === activeGroupId) ?? groups[0] ?? null;
  const activeConversationId =
    messageMode === "group"
      ? activeGroup?.id ?? ""
      : activeIdentity
        ? getPrivateConversationId(activeIdentity.id)
        : "";
  const activeMessages = React.useMemo(
    () =>
      activeConversationId
        ? messages
            .filter((message) => message.conversationId === activeConversationId)
            .sort((a, b) => a.sentAt - b.sentAt)
        : [],
    [activeConversationId, messages]
  );
  const activeMessageKey = activeMessages.at(-1)?.id ?? "empty";
  const canSendMessage = Boolean(
    activeIdentity &&
      messageText.trim() &&
      (messageMode === "private" || activeGroup)
  );
  const sortedIdentities = React.useMemo(
    () =>
      [...identities].sort((a, b) => {
        const latestA = getLatestIdentityMessage(messages, a.id)?.sentAt ?? a.createdAt;
        const latestB = getLatestIdentityMessage(messages, b.id)?.sentAt ?? b.createdAt;
        return latestB - latestA;
      }),
    [identities, messages]
  );
  const sortedGroups = React.useMemo(
    () =>
      [...groups].sort((a, b) => {
        const latestA = getLatestConversationMessage(messages, a.id)?.sentAt ?? a.createdAt;
        const latestB = getLatestConversationMessage(messages, b.id)?.sentAt ?? b.createdAt;
        return latestB - latestA;
      }),
    [groups, messages]
  );

  React.useEffect(() => {
    if (activeIdentityId || identities.length === 0) return;
    setActiveIdentityId(identities[0].id);
  }, [activeIdentityId, identities]);

  React.useEffect(() => {
    if (activeGroupId || groups.length === 0) return;
    setActiveGroupId(groups[0].id);
  }, [activeGroupId, groups]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const refreshTestConversations = () => {
      const nextIdentities = getInitialTestIdentities();
      const nextGroups = getInitialTestGroups();
      setIdentities(nextIdentities);
      setGroups(nextGroups);
      setMessages(getInitialTestMessages());
      setActiveIdentityId((currentIdentityId) => {
        if (
          currentIdentityId &&
          nextIdentities.some((identity) => identity.id === currentIdentityId)
        ) {
          return currentIdentityId;
        }
        return nextIdentities[0]?.id ?? "";
      });
      setActiveGroupId((currentGroupId) => {
        if (
          currentGroupId &&
          nextGroups.some((group) => group.id === currentGroupId)
        ) {
          return currentGroupId;
        }
        return nextGroups[0]?.id ?? "";
      });
    };

    const handleStorage = (event: StorageEvent) => {
      if (
        event.key !== testIdentitiesStorageKey &&
        event.key !== testGroupsStorageKey &&
        event.key !== testMessagesStorageKey
      ) {
        return;
      }
      refreshTestConversations();
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(testConversationStorageEvent, refreshTestConversations);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(testConversationStorageEvent, refreshTestConversations);
    };
  }, []);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [activeMessageKey]);

  React.useEffect(() => {
    if (!showIdentityPicker) return;

    const closePickerOnOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        identityPickerRef.current?.contains(target)
      ) {
        return;
      }
      setShowIdentityPicker(false);
    };

    document.addEventListener("pointerdown", closePickerOnOutsidePointerDown);
    return () => {
      document.removeEventListener("pointerdown", closePickerOnOutsidePointerDown);
    };
  }, [showIdentityPicker]);

  React.useEffect(() => {
    if (!showGroupPicker) return;

    const closePickerOnOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && groupPickerRef.current?.contains(target)) {
        return;
      }
      setShowGroupPicker(false);
    };

    document.addEventListener("pointerdown", closePickerOnOutsidePointerDown);
    return () => {
      document.removeEventListener("pointerdown", closePickerOnOutsidePointerDown);
    };
  }, [showGroupPicker]);

  React.useEffect(() => {
    if (!showAdminInfo) return;

    const closeInfoOnOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && adminInfoRef.current?.contains(target)) {
        return;
      }
      setShowAdminInfo(false);
    };

    document.addEventListener("pointerdown", closeInfoOnOutsidePointerDown);
    return () => {
      document.removeEventListener("pointerdown", closeInfoOnOutsidePointerDown);
    };
  }, [showAdminInfo]);

  const handleCreateIdentity = () => {
    const normalizedName = identityName.trim();
    if (!normalizedName) return;

    setIdentities((prev) => {
      const nextIdentities = [
        ...prev,
        createTestIdentity(normalizedName, identityNote, prev.length),
      ];
      persistTestIdentities(nextIdentities);
      setActiveIdentityId(nextIdentities.at(-1)?.id ?? "");
      return nextIdentities;
    });
    setShowCreateIdentityModal(false);
    setShowIdentityPicker(false);
    setIdentityName("");
    setIdentityNote("");
  };

  const closeCreateIdentityModal = () => {
    setShowCreateIdentityModal(false);
    setIdentityName("");
    setIdentityNote("");
  };

  const handleCreateGroup = () => {
    const normalizedName = groupName.trim();
    if (!normalizedName) return;

    setGroups((prev) => {
      const nextGroups = [
        ...prev,
        createTestGroup(
          normalizedName,
          groupNote,
          identities.map((identity) => identity.id),
          prev.length
        ),
      ];
      persistTestGroups(nextGroups);
      setActiveGroupId(nextGroups.at(-1)?.id ?? "");
      setMessageMode("group");
      persistAdminMessageMode("group");
      return nextGroups;
    });
    setShowCreateGroupModal(false);
    setShowGroupPicker(false);
    setGroupName("");
    setGroupNote("");
  };

  const closeCreateGroupModal = () => {
    setShowCreateGroupModal(false);
    setGroupName("");
    setGroupNote("");
  };

  const handleSendMessage = () => {
    if (!activeIdentity || !messageText.trim()) return;
    if (messageMode === "group" && !activeGroup) return;

    const nextMessage =
      messageMode === "group" && activeGroup
        ? createTestGroupMessage(activeGroup.id, activeIdentity.id, messageText)
        : createTestMessage(activeIdentity.id, messageText);
    const nextMessages = [...messages, nextMessage];
    setMessages(nextMessages);
    persistTestMessages(nextMessages);
    setMessageText("");
  };

  const handleMessageKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (event.key !== "Enter" || event.shiftKey) return;

    event.preventDefault();
    handleSendMessage();
  };

  return (
    <div
      className="flex h-[calc(100vh-48px)] w-full self-stretch flex-col overflow-hidden bg-[var(--admin-bg)] text-text"
    >
      <main className="mx-auto flex min-h-0 w-full max-w-[600px] flex-1 px-4 py-4 sm:px-0">
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[16px] border border-[var(--admin-border)] bg-[var(--admin-panel-bg)] [box-shadow:var(--admin-panel-shadow)]">
          <div className="flex min-h-[52px] shrink-0 items-center justify-between gap-4 border-b border-[var(--admin-border-subtle)] px-5 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="truncate text-[17px] font-normal leading-6 text-text">
                发给移动端 Demo
              </h2>
              <div ref={adminInfoRef} className="relative shrink-0">
                <button
                  type="button"
                  className="flex h-5 w-5 items-center justify-center rounded-full border border-[var(--admin-border)] text-[12px] font-medium leading-none text-text-tertiary transition hover:border-primary hover:text-primary focus:outline-none focus-visible:[box-shadow:var(--admin-input-focus-shadow)]"
                  onClick={() => setShowAdminInfo((open) => !open)}
                  aria-label="查看消息测试说明"
                  aria-expanded={showAdminInfo}
                >
                  i
                </button>
                {showAdminInfo && (
                  <div className="absolute left-0 top-7 z-30 w-[260px] rounded-[12px] border border-[var(--admin-border)] bg-[var(--admin-dialog-bg)] px-3 py-2.5 text-[12px] leading-5 text-text-muted [box-shadow:var(--admin-floating-shadow)]">
                    在此后台可以向移动端 Demo 发消息，方便测试那边的消息接收、AI 对消息上下文的处理等。
                  </div>
                )}
              </div>
            </div>
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-[13px] leading-5 text-text-tertiary underline decoration-[var(--admin-border)] underline-offset-4 transition hover:text-primary hover:decoration-primary focus:outline-none focus-visible:[box-shadow:var(--admin-input-focus-shadow)]"
            >
              打开移动端 Demo ↗
            </a>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border-subtle)] px-5 py-3">
            <div className="inline-flex rounded-[10px] bg-[var(--admin-panel-muted-bg)] p-1">
              {(["private", "group"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={cn(
                    "h-8 rounded-[8px] px-3 text-[13px] transition focus:outline-none focus-visible:[box-shadow:var(--admin-input-focus-shadow)]",
                    messageMode === mode
                      ? "bg-[var(--admin-dialog-bg)] text-text [box-shadow:var(--shadow-sm)]"
                      : "text-text-tertiary hover:text-text"
                  )}
                  onClick={() => {
                    setMessageMode(mode);
                    persistAdminMessageMode(mode);
                    setShowGroupPicker(false);
                    setShowIdentityPicker(false);
                  }}
                >
                  {mode === "private" ? "私聊" : "群聊"}
                </button>
              ))}
            </div>
            {messageMode === "group" && (
              <div ref={groupPickerRef} className="relative min-w-0">
                <button
                  type="button"
                  className="inline-flex max-w-[260px] items-center rounded-[10px] border border-[var(--admin-border)] bg-[var(--admin-input-bg)] px-3 py-2 text-[12px] leading-4 text-text-tertiary transition hover:border-primary hover:bg-[var(--admin-input-hover-bg)] hover:text-text focus:outline-none focus-visible:[box-shadow:var(--admin-input-focus-shadow)]"
                  onClick={() => {
                    setShowGroupPicker((open) => !open);
                    setShowIdentityPicker(false);
                  }}
                  aria-expanded={showGroupPicker}
                >
                  <span className="mr-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <span className="truncate">
                    发到 {activeGroup?.name ?? "选择群聊"}
                  </span>
                  <span className="ml-1 shrink-0 text-[14px] leading-none">⌄</span>
                </button>
                {showGroupPicker && (
                  <GroupPickerDropdown
                    align="right"
                    groups={sortedGroups}
                    messages={messages}
                    activeGroup={activeGroup}
                    onSelect={(groupId) => {
                      setActiveGroupId(groupId);
                      setShowGroupPicker(false);
                    }}
                    onCreate={() => {
                      setShowGroupPicker(false);
                      setShowCreateGroupModal(true);
                    }}
                  />
                )}
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-4">
            <div className="mx-auto flex min-h-full w-full flex-col">
              {activeMessages.length > 0 ? (
                <AdminConversationMessages
                  identity={activeIdentity}
                  identities={identities}
                  mode={messageMode}
                  messages={activeMessages}
                />
              ) : (
                <div className="flex flex-1 items-center justify-center px-4 text-center">
                  <div>
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-fill-4 text-[18px] text-text-tertiary">
                      +
                    </div>
                    <p className="mt-3 text-[14px] leading-5 text-text-muted">
                      暂无发送记录
                    </p>
                    <p className="mt-1 text-[12px] leading-5 text-text-tertiary">
                      {messageMode === "group"
                        ? "选择群聊和发送身份后，从下方输入框发送第一条群聊测试消息。"
                        : "选择或创建身份后，从下方输入框发送第一条私聊测试消息。"}
                    </p>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="shrink-0 bg-[var(--admin-panel-bg)] px-5 pb-4 pt-3">
            {activeIdentity ? (
              <div
                className="admin-message-input-shell mx-auto w-full rounded-[14px] border bg-[var(--admin-input-bg)] transition hover:bg-[var(--admin-input-hover-bg)]"
                style={{
                  borderColor: messageTextFocused
                    ? "var(--primary)"
                    : "var(--admin-border)",
                  boxShadow: messageTextFocused
                    ? "var(--admin-input-focus-shadow)"
                    : undefined,
                }}
              >
                <textarea
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                  onKeyDown={handleMessageKeyDown}
                  onFocus={() => setMessageTextFocused(true)}
                  onBlur={() => setMessageTextFocused(false)}
                  placeholder=""
                  className="admin-message-textarea block min-h-[78px] w-full resize-none rounded-t-[14px] border-0 bg-transparent px-4 py-3 text-[15px] leading-[1.55] text-text outline-none placeholder:text-input-placeholder focus-visible:shadow-none"
                  rows={3}
                />
                <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 pb-3">
                  <div className="flex min-w-0 flex-1 items-center gap-1.5">
                    <div ref={identityPickerRef} className="relative min-w-0">
                      <button
                        type="button"
                        className="inline-flex max-w-full items-center rounded-full px-2 py-1 text-[12px] leading-4 text-text-tertiary transition hover:bg-hover-overlay focus:outline-none focus-visible:[box-shadow:var(--admin-input-focus-shadow)]"
                        onClick={() => {
                          setShowIdentityPicker((open) => !open);
                          setShowGroupPicker(false);
                        }}
                        aria-expanded={showIdentityPicker}
                      >
                        <span className="mr-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                        <span className="truncate">以 {activeIdentity.name} 的身份发送</span>
                        <span className="ml-1 shrink-0 text-[14px] leading-none">⌄</span>
                      </button>
                      {showIdentityPicker && (
                        <IdentityPickerDropdown
                          identities={sortedIdentities}
                          messages={messages}
                          activeIdentity={activeIdentity}
                          onSelect={(identityId) => {
                            setActiveIdentityId(identityId);
                            setShowIdentityPicker(false);
                          }}
                          onCreate={() => {
                            setShowIdentityPicker(false);
                            setShowCreateIdentityModal(true);
                          }}
                        />
                      )}
                    </div>
                  </div>
                  <div className="ml-auto flex shrink-0 items-center gap-3">
                    <span className="text-[12px] leading-5 text-text-tertiary">
                      Enter发送 / Shift+Enter换行
                    </span>
                    <button
                      type="button"
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-text text-bg transition hover:opacity-[0.88] active:scale-[0.92] disabled:cursor-not-allowed disabled:opacity-35 focus:outline-none focus-visible:[box-shadow:var(--admin-input-focus-shadow)]"
                      onClick={handleSendMessage}
                      disabled={!canSendMessage}
                      aria-label="发送消息"
                    >
                      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path
                          d="M4.7 12.5 18.8 5.6c.7-.35 1.42.34 1.08 1.05l-6.7 14.2c-.31.66-1.27.55-1.42-.16l-1.18-5.66a1.3 1.3 0 0 0-1.02-1.01l-4.7-.92c-.76-.15-.88-1.16-.16-1.5Z"
                          fill="currentColor"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[176px] items-center justify-center rounded-[12px] bg-[var(--admin-panel-muted-bg)] text-sm text-text-tertiary">
                请先在上方创建一个发送身份。
              </div>
            )}
          </div>
        </section>
      </main>
      {showCreateIdentityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-[var(--admin-overlay)] backdrop-blur-[2px]"
            onClick={closeCreateIdentityModal}
            aria-label="关闭新增身份弹窗"
          />
          <form
            className="relative z-10 w-full max-w-[420px] rounded-[14px] border border-[var(--admin-border)] bg-[var(--admin-dialog-bg)] p-5 text-text [box-shadow:var(--admin-floating-shadow)]"
            onSubmit={(event) => {
              event.preventDefault();
              handleCreateIdentity();
            }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">新增身份</h2>
              <button
                type="button"
                className="rounded-[8px] px-2 py-1 text-sm text-text-tertiary transition hover:bg-hover-overlay focus:outline-none focus-visible:[box-shadow:var(--admin-input-focus-shadow)]"
                onClick={closeCreateIdentityModal}
              >
                关闭
              </button>
            </div>
            <label className="mt-4 block text-xs font-medium text-text-tertiary">
              昵称
              <input
                value={identityName}
                onChange={(event) => setIdentityName(event.target.value)}
                placeholder="例如：产品经理、用户B"
                autoFocus
                className="mt-1 h-10 w-full rounded-[10px] border border-[var(--admin-border)] bg-[var(--admin-input-bg)] px-3 text-sm text-text outline-none transition placeholder:text-input-placeholder focus:border-primary focus:[box-shadow:var(--admin-input-focus-shadow)]"
              />
            </label>
            <label className="mt-3 block text-xs font-medium text-text-tertiary">
              备注
              <input
                value={identityNote}
                onChange={(event) => setIdentityNote(event.target.value)}
                placeholder="例如：模拟需求反馈"
                className="mt-1 h-10 w-full rounded-[10px] border border-[var(--admin-border)] bg-[var(--admin-input-bg)] px-3 text-sm text-text outline-none transition placeholder:text-input-placeholder focus:border-primary focus:[box-shadow:var(--admin-input-focus-shadow)]"
              />
            </label>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                className="h-10 rounded-[10px] border border-[var(--admin-border)] px-4 text-sm font-medium text-text transition hover:bg-hover-overlay focus:outline-none focus-visible:[box-shadow:var(--admin-input-focus-shadow)]"
                onClick={closeCreateIdentityModal}
              >
                取消
              </button>
              <button
                type="submit"
                className="h-10 rounded-[10px] bg-primary px-4 text-sm font-semibold text-on-primary transition hover:bg-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:[box-shadow:var(--admin-input-focus-shadow)]"
                disabled={!identityName.trim()}
              >
                创建身份
              </button>
            </div>
          </form>
        </div>
      )}
      {showCreateGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-[var(--admin-overlay)] backdrop-blur-[2px]"
            onClick={closeCreateGroupModal}
            aria-label="关闭新增群弹窗"
          />
          <form
            className="relative z-10 w-full max-w-[420px] rounded-[14px] border border-[var(--admin-border)] bg-[var(--admin-dialog-bg)] p-5 text-text [box-shadow:var(--admin-floating-shadow)]"
            onSubmit={(event) => {
              event.preventDefault();
              handleCreateGroup();
            }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">新增测试群</h2>
              <button
                type="button"
                className="rounded-[8px] px-2 py-1 text-sm text-text-tertiary transition hover:bg-hover-overlay focus:outline-none focus-visible:[box-shadow:var(--admin-input-focus-shadow)]"
                onClick={closeCreateGroupModal}
              >
                关闭
              </button>
            </div>
            <label className="mt-4 block text-xs font-medium text-text-tertiary">
              群名称
              <input
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                placeholder="例如：产品讨论群"
                autoFocus
                className="mt-1 h-10 w-full rounded-[10px] border border-[var(--admin-border)] bg-[var(--admin-input-bg)] px-3 text-sm text-text outline-none transition placeholder:text-input-placeholder focus:border-primary focus:[box-shadow:var(--admin-input-focus-shadow)]"
              />
            </label>
            <label className="mt-3 block text-xs font-medium text-text-tertiary">
              备注
              <input
                value={groupNote}
                onChange={(event) => setGroupNote(event.target.value)}
                placeholder="例如：模拟多人需求讨论"
                className="mt-1 h-10 w-full rounded-[10px] border border-[var(--admin-border)] bg-[var(--admin-input-bg)] px-3 text-sm text-text outline-none transition placeholder:text-input-placeholder focus:border-primary focus:[box-shadow:var(--admin-input-focus-shadow)]"
              />
            </label>
            <p className="mt-3 text-xs leading-5 text-text-tertiary">
              新群会默认包含当前所有测试身份，后续可用不同身份向群里发消息。
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                className="h-10 rounded-[10px] border border-[var(--admin-border)] px-4 text-sm font-medium text-text transition hover:bg-hover-overlay focus:outline-none focus-visible:[box-shadow:var(--admin-input-focus-shadow)]"
                onClick={closeCreateGroupModal}
              >
                取消
              </button>
              <button
                type="submit"
                className="h-10 rounded-[10px] bg-primary px-4 text-sm font-semibold text-on-primary transition hover:bg-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:[box-shadow:var(--admin-input-focus-shadow)]"
                disabled={!groupName.trim()}
              >
                创建群
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function AdminConversationMessages({
  identity,
  identities,
  mode,
  messages,
}: {
  identity: TestIdentity | null;
  identities: TestIdentity[];
  mode: TestConversationType;
  messages: TestMessage[];
}) {
  let previousSentAt = 0;

  return (
    <div className="space-y-5">
      {messages.map((message, index) => {
        const showTime =
          index === 0 || Math.abs(message.sentAt - previousSentAt) > 1000 * 60 * 5;
        previousSentAt = message.sentAt;

        return (
          <div key={message.id} className="space-y-3">
            {showTime && (
              <div className="flex justify-center">
                <span className="text-[13px] font-medium leading-5 text-text-disabled">
                  {formatConversationTime(message.sentAt)}
                </span>
              </div>
            )}
            {message.sender === "demo" ? (
              <div className="flex items-start justify-start gap-2.5">
                <DemoAvatar />
                <MessageBubble align="left" text={message.text} />
              </div>
            ) : (
              <div className="flex items-start justify-end gap-3">
                <div className="flex max-w-[76%] flex-col items-end gap-1">
                  {mode === "group" && (
                    <span className="pr-1 text-[11px] leading-4 text-text-tertiary">
                      {identities.find((item) => item.id === message.identityId)?.name ??
                        "群成员"}
                    </span>
                  )}
                  <MessageBubble align="right" text={message.text} />
                </div>
                {(identities.find((item) => item.id === message.identityId) ?? identity) && (
                  <IdentityAvatar
                    identity={
                      identities.find((item) => item.id === message.identityId) ??
                      identity!
                    }
                    large
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function GroupPickerDropdown({
  align = "left",
  groups,
  messages,
  activeGroup,
  onSelect,
  onCreate,
}: {
  align?: "left" | "right";
  groups: TestGroup[];
  messages: TestMessage[];
  activeGroup: TestGroup | null;
  onSelect: (groupId: string) => void;
  onCreate: () => void;
}) {
  return (
    <div
      className={cn(
        "absolute z-20 w-[320px] max-w-[calc(100vw-48px)] rounded-[14px] border border-[var(--admin-border)] bg-[var(--admin-dialog-bg)] p-2 [box-shadow:var(--admin-floating-shadow)]",
        align === "right"
          ? "right-0 top-full mt-2"
          : "bottom-full left-1 mb-2"
      )}
    >
      <div className="max-h-[260px] space-y-1 overflow-auto">
        {groups.map((group) => {
          const messageCount = messages.filter(
            (message) => message.conversationId === group.id
          ).length;
          const active = group.id === activeGroup?.id;
          return (
            <button
              key={group.id}
              type="button"
              className={cn(
                "flex w-full items-center rounded-[10px] px-3 py-2.5 text-left transition focus:outline-none focus-visible:[box-shadow:var(--admin-input-focus-shadow)]",
                active ? "bg-primary-selected" : "hover:bg-hover-overlay"
              )}
              onClick={() => onSelect(group.id)}
            >
              <GroupAvatar group={group} />
              <span className="ml-3 min-w-0 flex-1">
                <span className="flex min-w-0 items-center justify-between gap-2">
                  <span className="truncate text-[14px] font-medium text-text">
                    {group.name}
                  </span>
                  <span className="shrink-0 text-[11px] text-text-tertiary">
                    {messageCount}条
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-xs text-text-tertiary">
                  {group.note.trim() || "此群聊暂无备注"}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="mt-2 flex h-10 w-full items-center rounded-[10px] border border-[var(--admin-border-subtle)] px-3 text-left text-sm font-medium text-text transition hover:bg-hover-overlay focus:outline-none focus-visible:[box-shadow:var(--admin-input-focus-shadow)]"
        onClick={onCreate}
      >
        <span className="flex items-center">
          <span className="mr-2 flex h-6 w-6 items-center justify-center rounded-full bg-fill-4 text-base leading-none">
            +
          </span>
          创建新群聊
        </span>
      </button>
    </div>
  );
}

function IdentityPickerDropdown({
  identities,
  messages,
  activeIdentity,
  onSelect,
  onCreate,
}: {
  identities: TestIdentity[];
  messages: TestMessage[];
  activeIdentity: TestIdentity;
  onSelect: (identityId: string) => void;
  onCreate: () => void;
}) {
  return (
    <div className="absolute bottom-full left-1 z-20 mb-2 w-[320px] max-w-[calc(100vw-48px)] rounded-[14px] border border-[var(--admin-border)] bg-[var(--admin-dialog-bg)] p-2 [box-shadow:var(--admin-floating-shadow)]">
      <div className="max-h-[260px] space-y-1 overflow-auto">
        {identities.map((identity) => {
          const messageCount = messages.filter(
            (message) => message.identityId === identity.id
          ).length;
          const active = identity.id === activeIdentity.id;
          return (
            <button
              key={identity.id}
              type="button"
              className={cn(
                "flex w-full items-center rounded-[10px] px-3 py-2.5 text-left transition focus:outline-none focus-visible:[box-shadow:var(--admin-input-focus-shadow)]",
                active ? "bg-primary-selected" : "hover:bg-hover-overlay"
              )}
              onClick={() => onSelect(identity.id)}
            >
              <IdentityAvatar identity={identity} />
              <span className="ml-3 min-w-0 flex-1">
                <span className="flex min-w-0 items-center justify-between gap-2">
                  <span className="truncate text-[14px] font-medium text-text">
                    {identity.name}
                  </span>
                  <span className="shrink-0 text-[11px] text-text-tertiary">
                    已发{messageCount}条
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-xs text-text-tertiary">
                  {identity.note.trim() || "此身份暂无备注"}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="mt-2 flex h-10 w-full items-center rounded-[10px] border border-[var(--admin-border-subtle)] px-3 text-left text-sm font-medium text-text transition hover:bg-hover-overlay focus:outline-none focus-visible:[box-shadow:var(--admin-input-focus-shadow)]"
        onClick={onCreate}
      >
        <span className="flex items-center">
          <span className="mr-2 flex h-6 w-6 items-center justify-center rounded-full bg-fill-4 text-base leading-none">
            +
          </span>
          创建新身份
        </span>
      </button>
    </div>
  );
}

function GroupAvatar({ group }: { group: TestGroup }) {
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-white"
      style={{ backgroundColor: group.color }}
    >
      {group.avatarLabel}
    </span>
  );
}

function formatConversationTime(timestamp: number) {
  const dayLabel = formatTimeLabel(timestamp);
  const timeLabel = formatBubbleTime(timestamp);
  return dayLabel === "今天" ? timeLabel : `${dayLabel} ${timeLabel}`;
}

function MessageBubble({
  align,
  text,
}: {
  align: "left" | "right";
  text: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-[12px] border border-[var(--admin-border-subtle)] bg-[var(--admin-bubble-bg)] px-3.5 py-2.5 text-left text-text [box-shadow:var(--shadow-sm)] transition hover:bg-[var(--admin-bubble-hover-bg)] active:scale-[0.995] focus:outline-none focus-visible:[box-shadow:var(--admin-input-focus-shadow)]",
        align === "right"
          ? "w-fit max-w-full rounded-tr-[4px]"
          : "max-w-[76%] rounded-tl-[4px]"
      )}
      onContextMenu={(event) => {
        event.preventDefault();
      }}
    >
      <p className="whitespace-pre-wrap break-words text-[15px] font-normal leading-[1.55] tracking-normal">
        {text}
      </p>
    </button>
  );
}

function DemoAvatar() {
  return (
    <span
      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold leading-none text-on-primary"
      aria-hidden="true"
    >
      我
    </span>
  );
}

function IdentityAvatar({
  identity,
  small = false,
  large = false,
}: {
  identity: TestIdentity;
  small?: boolean;
  large?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white",
        large ? "h-8 w-8 text-[11px]" : small ? "h-7 w-7" : "h-9 w-9"
      )}
      style={{ backgroundColor: identity.color }}
      aria-hidden="true"
    >
      {identity.avatarLabel}
    </span>
  );
}
