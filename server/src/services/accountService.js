import RefreshToken from "../models/RefreshToken.js";
import User from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";

export async function deleteOwnAccount(userId, currentPassword, confirmation) {
  if (confirmation !== "DELETE") throw new ApiError(400, "DELETE_CONFIRMATION_REQUIRED", "Type DELETE to confirm account deletion");
  const user = await User.findById(userId).select("+password");
  if (!user || !(await user.comparePassword(currentPassword))) throw new ApiError(400, "CURRENT_PASSWORD_INVALID", "Current password is incorrect");
  user.isDeleted = true;
  user.status = "deactivated";
  user.email = `deleted_${user._id}_${Date.now()}@deleted.invalid`;
  user.profileImage = ""; user.profilePhoto = ""; user.profileImagePublicId = "";
  await user.save({ validateBeforeSave: false });
  await RefreshToken.deleteMany({ user: user._id });
  return user;
}
