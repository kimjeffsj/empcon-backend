import Joi from "joi";

export const createEmployeeSchema = Joi.object({
  firstName: Joi.string().min(1).max(50).required(),
  lastName: Joi.string().min(1).max(50).required(),
  middleName: Joi.string().max(50).optional().allow(""),
  email: Joi.string().email().required(),
  phone: Joi.string().min(10).max(15).required(),
  addressLine1: Joi.string().min(1).max(100).required(),
  addressLine2: Joi.string().max(100).optional().allow(""),
  city: Joi.string().min(1).max(50).required(),
  province: Joi.string().length(2).required(),
  postalCode: Joi.string().min(6).max(7).required(),
  dateOfBirth: Joi.string().isoDate().required(),
  hireDate: Joi.string().isoDate().required(),
  payRate: Joi.number().min(0).max(999999).required(),
  payType: Joi.string().valid("HOURLY", "SALARY").required(),
  role: Joi.string().valid("EMPLOYEE", "MANAGER").optional().default("EMPLOYEE"),
  departmentId: Joi.string().required(),
  positionId: Joi.string().required(),
  managerId: Joi.string().optional().allow("", null),
  sin: Joi.string().min(9).max(11).required(),
  emergencyContactName: Joi.string().max(100).optional().allow(""),
  emergencyContactPhone: Joi.string().max(15).optional().allow(""),
  notes: Joi.string().max(500).optional().allow(""),
});

export const updateEmployeeSchema = Joi.object({
  firstName: Joi.string().min(1).max(50).optional(),
  lastName: Joi.string().min(1).max(50).optional(),
  middleName: Joi.string().max(50).optional().allow(""),
  email: Joi.string().email().optional(),
  phone: Joi.string().min(10).max(15).optional(),
  addressLine1: Joi.string().min(1).max(100).optional(),
  addressLine2: Joi.string().max(100).optional().allow(""),
  city: Joi.string().min(1).max(50).optional(),
  province: Joi.string().length(2).optional(),
  postalCode: Joi.string().min(6).max(7).optional(),
  dateOfBirth: Joi.string().isoDate().optional(),
  hireDate: Joi.string().isoDate().optional(),
  payRate: Joi.number().min(0).max(999999).optional(),
  payType: Joi.string().valid("HOURLY", "SALARY").optional(),
  departmentId: Joi.string().optional(),
  positionId: Joi.string().optional(),
  managerId: Joi.string().optional().allow(""),
  sin: Joi.string().min(9).max(11).optional(),
  status: Joi.string()
    .valid("ACTIVE", "INACTIVE", "TERMINATED", "ON_LEAVE")
    .optional(),
  emergencyContactName: Joi.string().max(100).optional().allow(""),
  emergencyContactPhone: Joi.string().max(15).optional().allow(""),
  notes: Joi.string().max(500).optional().allow(""),
});

export const employeeListQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().max(100).optional(),
  status: Joi.string()
    .valid("ACTIVE", "INACTIVE", "TERMINATED", "ON_LEAVE")
    .optional(),
  departmentId: Joi.string().optional(),
  positionId: Joi.string().optional(),
  managerId: Joi.string().optional(),
  sortBy: Joi.string()
    .valid("firstName", "lastName", "email", "hireDate", "createdAt")
    .default("createdAt"),
  sortOrder: Joi.string().valid("asc", "desc").default("desc"),
});

export const createDepartmentSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(500).optional().allow(""),
  managerId: Joi.string().optional().allow(""),
});

export const updateDepartmentSchema = Joi.object({
  name: Joi.string().min(1).max(100).optional(),
  description: Joi.string().max(500).optional().allow(""),
  managerId: Joi.string().optional().allow(""),
});

export const createPositionSchema = Joi.object({
  title: Joi.string().min(1).max(100).required(),
  departmentId: Joi.string().required(),
  description: Joi.string().max(500).optional().allow(""),
});

export const updatePositionSchema = Joi.object({
  title: Joi.string().min(1).max(100).optional(),
  departmentId: Joi.string().optional(),
  description: Joi.string().max(500).optional().allow(""),
});
