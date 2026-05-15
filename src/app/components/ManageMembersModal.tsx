'use client';

import {
  X,
  MoreVertical,
  ShieldAlert,
  ShieldCheck,
  Shield,
  Gavel,
  Check,
} from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { MemberRole, ServerMember } from '../../hooks/useServerMembers';

interface ManageMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: ServerMember[];
  myRole: MemberRole;
  currentUserId: string;
  onSetRole: (userId: string, role: MemberRole) => void;
  onKick: (userId: string) => void;
  readOnly?: boolean;
}

const AVATAR_COLORS = [
  '#5865f2', '#57f287', '#eb459e', '#ed4245', '#f47b67', '#fee75c',
];

function getAvatarColor(userId: string) {
  const sum = userId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

function RoleBadge({ role }: { role: MemberRole }) {
  if (role === 'admin')
    return <ShieldAlert className="w-4 h-4 text-[#f23f42] flex-shrink-0" />;
  if (role === 'moderator')
    return <ShieldCheck className="w-4 h-4 text-[#5865f2] flex-shrink-0" />;
  return null;
}

export function ManageMembersModal({
  isOpen,
  onClose,
  members,
  myRole,
  currentUserId,
  onSetRole,
  onKick,
  readOnly = false,
}: ManageMembersModalProps) {
  const [openMenuUserId, setOpenMenuUserId] = useState<string | null>(null);
  const [showRoleSubmenu, setShowRoleSubmenu] = useState(false);
  // Position of the dropdown menu (fixed, relative to viewport)
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);

  if (!isOpen) return null;

  const closeMenu = () => {
    setOpenMenuUserId(null);
    setShowRoleSubmenu(false);
    setMenuPos(null);
  };

  const openMenu = (userId: string, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    // Drop down below the button, right-aligned
    setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    setOpenMenuUserId(userId);
    setShowRoleSubmenu(false);
  };

  // The member whose context menu is open
  const openMember = members.find(m => m.userId === openMenuUserId) ?? null;
  const menuCanChangeRole =
    openMember && openMember.role !== 'admin' && myRole === 'admin';

  // Dropdown rendered via portal so it is never clipped by overflow
  const dropdown =
    openMenuUserId && menuPos &&
    createPortal(
      <>
        {/* Transparent overlay — click anywhere outside closes the menu */}
        <div
          className="fixed inset-0"
          style={{ zIndex: 9998 }}
          onClick={closeMenu}
        />

        {/* Context menu */}
        <div
          style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 9999 }}
          className="bg-[#111214] rounded-md shadow-2xl py-1 min-w-[160px]"
          onClick={e => e.stopPropagation()}
        >
          {/* Role — admin only */}
          {menuCanChangeRole && (
            <div
              className="relative"
              onMouseEnter={() => setShowRoleSubmenu(true)}
              onMouseLeave={() => setShowRoleSubmenu(false)}
            >
              <button className="w-full px-3 py-2 text-left text-[#b5bac1] hover:bg-[#5865f2] hover:text-white flex items-center justify-between text-sm transition-colors">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  <span>Role</span>
                </div>
                <span className="text-xs">›</span>
              </button>

              {/* Role submenu — child of dropdown, also in body → no clipping */}
              {showRoleSubmenu && (
                <div className="absolute right-full top-0 mr-1 bg-[#111214] rounded-md shadow-2xl py-1 min-w-[140px]">
                  {(['guest', 'moderator'] as MemberRole[]).map(role => (
                    <button
                      key={role}
                      onClick={() => {
                        onSetRole(openMenuUserId, role);
                        closeMenu();
                      }}
                      className="w-full px-3 py-2 text-left text-[#b5bac1] hover:bg-[#5865f2] hover:text-white flex items-center justify-between text-sm transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {role === 'moderator' ? (
                          <ShieldCheck className="w-4 h-4" />
                        ) : (
                          <Shield className="w-4 h-4 opacity-60" />
                        )}
                        <span className="capitalize">{role}</span>
                      </div>
                      {openMember?.role === role && (
                        <Check className="w-4 h-4" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Kick — admin + moderator */}
          <button
            onClick={() => {
              onKick(openMenuUserId);
              closeMenu();
            }}
            className="w-full px-3 py-2 text-left text-[#f23f42] hover:bg-[#f23f42] hover:text-white flex items-center gap-2 text-sm transition-colors"
          >
            <Gavel className="w-4 h-4" />
            <span>Kick</span>
          </button>
        </div>
      </>,
      document.body
    );

  return (
    <>
      <div
        className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
        onClick={() => { onClose(); closeMenu(); }}
      >
        <div
          className="bg-white rounded-lg w-[480px] max-h-[600px] flex flex-col relative"
          onClick={e => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-[#4e5058] hover:text-[#1e1f22] transition-colors z-10"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Header */}
          <div className="text-center pt-6 pb-2 px-6">
            <h2 className="text-[#313338] text-2xl font-bold">{readOnly ? 'Member List' : 'Manage Members'}</h2>
            <p className="text-[#4e5058] text-sm mt-1">{members.length} Members</p>
          </div>

          {/* Member list — overflow-y-auto no longer clips the menu */}
          <div className="overflow-y-auto px-4 pb-6 mt-2">
            {members.map(member => {
              const isSelf = member.userId === currentUserId;
              const isAdminMember = member.role === 'admin';
              const canSeeMenu =
                !readOnly &&
                !isSelf &&
                !isAdminMember &&
                (myRole === 'admin' || myRole === 'moderator');
              const isMenuOpen = openMenuUserId === member.userId;

              return (
                <div
                  key={member.userId}
                  className="flex items-center gap-3 px-2 py-3 rounded-lg hover:bg-[#f2f3f5] group"
                >
                  {/* Avatar */}
                  <div
                    className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-base select-none"
                    style={{ backgroundColor: getAvatarColor(member.userId) }}
                  >
                    {member.username.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[#313338] font-semibold text-sm truncate">
                        {member.username}
                      </span>
                      <RoleBadge role={member.role} />
                    </div>
                    <span className="text-[#80848e] text-xs capitalize">{member.role}</span>
                  </div>

                  {/* 3-dot button */}
                  {canSeeMenu && (
                    <button
                      onClick={e => openMenu(member.userId, e)}
                      className={`p-1.5 rounded text-[#80848e] hover:text-[#313338] hover:bg-[#e3e5e8] transition-colors flex-shrink-0 ${
                        isMenuOpen
                          ? 'opacity-100'
                          : 'opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Portal dropdown — renders directly in <body>, never clipped */}
      {dropdown}
    </>
  );
}
