import type { RequestHandler } from "express";
import {
  createAccountService,
  getAccountService,
  listAccountsService,
  updateAccountService,
} from "../services/account.service.js";
import ApiError from "../utils/ApiError.js";
import type { AccountListQuery, CreateAccountInput, UpdateAccountInput } from "../validators/account.validator.js";

export const listAccounts: RequestHandler = async (req, res, next) => {
  try {
    const result = await listAccountsService(req.query as AccountListQuery);
    res.status(200).json({ success: true, data: result, message: "Accounts fetched successfully" });
  } catch (error) {
    next(error);
  }
};

export const getAccount: RequestHandler = async (req, res, next) => {
  try {
    const account = await getAccountService(String(req.params.id));
    res.status(200).json({ success: true, data: { account }, message: "Account fetched successfully" });
  } catch (error) {
    next(error);
  }
};

export const createAccount: RequestHandler = async (req, res, next) => {
  try {
    const account = await createAccountService(req.body as CreateAccountInput);
    res.status(201).json({ success: true, data: { account }, message: "Account created successfully" });
  } catch (error) {
    next(error);
  }
};

export const updateAccount: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");
    const account = await updateAccountService(String(req.params.id), req.body as UpdateAccountInput, req.user._id.toString());
    res.status(200).json({ success: true, data: { account }, message: "Account updated successfully" });
  } catch (error) {
    next(error);
  }
};
