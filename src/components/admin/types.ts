import { RegisteredUser, UserRole } from '../../services/adminService';

export type AdminSection = 'overview' | 'users' | 'access' | 'activity' | 'system';

export interface AdminCommonProps {
  isMaster: boolean;
  isManager: boolean;
  currentUserRole: UserRole;
  currentActiveUser: RegisteredUser | null;
  showToast: (msg: string) => void;
}
