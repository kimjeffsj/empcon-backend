import Joi from "joi";

export const authSchemas = {
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(1).required(),
  }),

  register: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    role: Joi.string()
      .valid("ADMIN", "MANAGER", "EMPLOYEE")
      .optional()
      .default("EMPLOYEE"),
  }),

  refreshToken: Joi.object({
    refreshToken: Joi.string().required(),
  }),

  changePassword: Joi.object({
    currentPassword: Joi.string().min(1).required(),
    newPassword: Joi.string().min(8).required(),
    confirmPassword: Joi.string().min(8).required(),
  }),

  forgotPassword: Joi.object({
    email: Joi.string().email().required(),
  }),

  resetPassword: Joi.object({
    token: Joi.string().required(),
    newPassword: Joi.string().min(8).required(),
    confirmPassword: Joi.string().min(8).required(),
  }),
};
