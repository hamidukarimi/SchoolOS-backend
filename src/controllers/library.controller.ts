import type { Request, Response, NextFunction } from "express";
import {
  createBookService,
  getAllBooksService,
  getBookByIdService,
  updateBookService,
  deleteBookService,
  borrowBookService,
  returnBookService,
  getAllBorrowsService,
} from "../services/library.service.js";
import ApiError from "../utils/ApiError.js";

export const createBook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");
    const book = await createBookService(req.body, req.user);
    res.status(201).json({ success: true, data: book, message: "Book created successfully" });
  } catch (error) {
    next(error);
  }
};

export const getAllBooks = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { category, status, search, page, limit } = req.query;

    const filters: {
      category?: string;
      status?: string;
      search?: string;
      page?: number;
      limit?: number;
    } = {};

    if (category) filters.category = category as string;
    if (status) filters.status = status as string;
    if (search) filters.search = search as string;
    if (page) filters.page = Number(page);
    if (limit) filters.limit = Number(limit);

    const scope = req.schoolReadScope;
    if (!scope) throw new ApiError(500, "School read scope not initialized");
    const result = await getAllBooksService(filters, scope);
    res.status(200).json({ success: true, data: result, message: "Books fetched successfully" });
  } catch (error) {
    next(error);
  }
};

export const getBookById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    if (!id || Array.isArray(id)) {
      res.status(400).json({ success: false, message: "Book ID is required" });
      return;
    }
    const scope = req.schoolReadScope;
    if (!scope) throw new ApiError(500, "School read scope not initialized");
    const book = await getBookByIdService(id, scope);
    res.status(200).json({ success: true, data: book, message: "Book fetched successfully" });
  } catch (error) {
    next(error);
  }
};

export const updateBook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    if (!id || Array.isArray(id)) {
      res.status(400).json({ success: false, message: "Book ID is required" });
      return;
    }
    if (!req.user) throw new ApiError(401, "Unauthorized");
    const book = await updateBookService(id, req.body, req.user);
    res.status(200).json({ success: true, data: book, message: "Book updated successfully" });
  } catch (error) {
    next(error);
  }
};

export const deleteBook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    if (!id || Array.isArray(id)) {
      res.status(400).json({ success: false, message: "Book ID is required" });
      return;
    }
    if (!req.user) throw new ApiError(401, "Unauthorized");
    await deleteBookService(id, req.user);
    res.status(200).json({ success: true, data: null, message: "Book deleted successfully" });
  } catch (error) {
    next(error);
  }
};

export const borrowBook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    if (!id || Array.isArray(id)) {
      res.status(400).json({ success: false, message: "Book ID is required" });
      return;
    }
    if (!req.user) throw new ApiError(401, "Unauthorized");
    const borrow = await borrowBookService(id, req.body, req.user);
    res.status(201).json({ success: true, data: borrow, message: "Book borrowed successfully" });
  } catch (error) {
    next(error);
  }
};

export const returnBook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { borrowId } = req.params;
    if (!borrowId || Array.isArray(borrowId)) {
      res.status(400).json({ success: false, message: "Borrow ID is required" });
      return;
    }
    const { returnDate } = req.body;
    if (!req.user) throw new ApiError(401, "Unauthorized");
    const borrow = await returnBookService(borrowId, returnDate, req.user);
    res.status(200).json({ success: true, data: borrow, message: "Book returned successfully" });
  } catch (error) {
    next(error);
  }
};

export const getAllBorrows = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const scope = req.schoolReadScope;
    if (!scope) throw new ApiError(500, "School read scope not initialized");

    const { borrowerId, bookId, status, page, limit } = req.query;

    const filters: {
      borrowerId?: string;
      bookId?: string;
      status?: string;
      page?: number;
      limit?: number;
    } = {};

    if (borrowerId) filters.borrowerId = borrowerId as string;
    if (bookId) filters.bookId = bookId as string;
    if (status) filters.status = status as string;
    if (page) filters.page = Number(page);
    if (limit) filters.limit = Number(limit);

    const result = await getAllBorrowsService(filters, scope);
    res.status(200).json({ success: true, data: result, message: "Borrows fetched successfully" });
  } catch (error) {
    next(error);
  }
};