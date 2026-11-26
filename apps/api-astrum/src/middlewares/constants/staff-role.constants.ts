import type { StaffRole } from "../../common/types/staff.types";
import { STAFF_ERROR_CODES } from "../../modules/staff/constants/staff.constants";

export type StaffRoleGuardConfig = {
  role: StaffRole;
  refusalCode: string;
  event: string;
  message: string;
};

export const STAFF_ROLE_UNAVAILABLE_MESSAGE =
  "The staff role could not be read";

export const STAFF_ROLE_GUARD_CONFIGS: Record<StaffRole, StaffRoleGuardConfig> =
  {
    POINT_WORKER: {
      role: "POINT_WORKER",
      refusalCode: STAFF_ERROR_CODES.notPointWorker,
      event: "staff.point-worker.refused",
      message: "This account does not work at a pickup point",
    },
    COURIER: {
      role: "COURIER",
      refusalCode: STAFF_ERROR_CODES.notCourier,
      event: "staff.courier.refused",
      message: "This account is not a courier",
    },
  };
