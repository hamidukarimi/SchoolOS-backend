import mongoose from "mongoose";
import type { QueryFilter } from "mongoose";
import Book from "../models/Book.model.js";
import type { IBook } from "../models/Book.model.js";
import BookBorrow from "../models/BookBorrow.model.js";
import type { IBookBorrow } from "../models/BookBorrow.model.js";
import type { IUserDocument } from "../models/User.model.js";
import type { SchoolReadScope } from "../types/schoolReadScope.js";
import ApiError from "../utils/ApiError.js";
import {
  assertSchoolDataAccess,
  assertSchoolMutationAllowed,
  idInObjectIdList,
} from "../utils/schoolReadAccess.js";

export const createBookService = async (
  data: Partial<IBook>,
  actor: IUserDocument,
) => {
  assertSchoolMutationAllowed(actor);

  const book = await Book.create(data);
  return book;
};

export const getAllBooksService = async (filters: {
  category?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}) => {
  const { category, status, search, page = 1, limit = 20 } = filters;

  const query: QueryFilter<IBook> = {};

  if (category) query.category = { $regex: category, $options: "i" };
  if (status) query.status = status;
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: "i" } },
      { author: { $regex: search, $options: "i" } },
      { isbn: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (page - 1) * limit;

  const [books, total] = await Promise.all([
    Book.find(query).skip(skip).limit(limit).sort({ createdAt: -1 }),
    Book.countDocuments(query),
  ]);

  return {
    books,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

export const getBookByIdService = async (id: string) => {
  const book = await Book.findById(id);

  if (!book) {
    throw new ApiError(404, "Book not found");
  }

  return book;
};

export const updateBookService = async (
  id: string,
  data: Partial<IBook>,
  actor: IUserDocument,
) => {
  assertSchoolMutationAllowed(actor);

  const book = await Book.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  });

  if (!book) {
    throw new ApiError(404, "Book not found");
  }

  return book;
};

export const deleteBookService = async (
  id: string,
  actor: IUserDocument,
) => {
  assertSchoolMutationAllowed(actor);

  const activeBorrows = await BookBorrow.countDocuments({
    bookId: id,
    status: "borrowed",
  });

  if (activeBorrows > 0) {
    throw new ApiError(400, "Cannot delete book with active borrows");
  }

  const book = await Book.findByIdAndDelete(id);

  if (!book) {
    throw new ApiError(404, "Book not found");
  }

  return book;
};

export const borrowBookService = async (
  bookId: string,
  data: {
    borrowerId: string;
    borrowerType: "student" | "teacher";
    dueDate: string;
  },
  actor: IUserDocument,
) => {
  assertSchoolMutationAllowed(actor);

  const book = await Book.findById(bookId);

  if (!book) {
    throw new ApiError(404, "Book not found");
  }

  if (book.availableCopies <= 0) {
    throw new ApiError(400, "No copies available for borrowing");
  }

  const activeBorrowQuery: QueryFilter<IBookBorrow> = {
    bookId,
    borrowerId: data.borrowerId,
    status: "borrowed",
  };
  const activeBorrow = await BookBorrow.findOne(activeBorrowQuery);

  if (activeBorrow) {
    throw new ApiError(400, "Borrower already has an active borrow for this book");
  }

  const borrow = await BookBorrow.create({
    bookId,
    borrowerId: data.borrowerId,
    borrowerType: data.borrowerType,
    dueDate: new Date(data.dueDate),
  });

  book.availableCopies -= 1;
  if (book.availableCopies === 0) {
    book.status = "unavailable";
  }
  await book.save();

  return borrow;
};

export const returnBookService = async (
  borrowId: string,
  returnDate: string | undefined,
  actor: IUserDocument,
) => {
  assertSchoolMutationAllowed(actor);

  const borrow = await BookBorrow.findById(borrowId);

  if (!borrow) {
    throw new ApiError(404, "Borrow record not found");
  }

  if (borrow.status === "returned") {
    throw new ApiError(400, "Book already returned");
  }

  borrow.status = "returned";
  borrow.returnDate = returnDate ? new Date(returnDate) : new Date();
  await borrow.save();

  const book = await Book.findById(borrow.bookId);
  if (book) {
    book.availableCopies += 1;
    book.status = "available";
    await book.save();
  }

  return borrow;
};

export const getAllBorrowsService = async (
  filters: {
    borrowerId?: string;
    bookId?: string;
    status?: string;
    page?: number;
    limit?: number;
  },
  scope: SchoolReadScope,
) => {
  assertSchoolDataAccess(scope);

  const { borrowerId, bookId, status, page = 1, limit = 20 } = filters;

  const query: Record<string, unknown> = {};

  if (bookId) query.bookId = bookId;
  if (status) query.status = status;

  if (scope.kind === "student") {
    if (
      borrowerId &&
      borrowerId !== scope.studentDocId.toString()
    ) {
      throw new ApiError(403, "You do not have access to these borrow records.");
    }
    query.borrowerId = scope.studentDocId;
    query.borrowerType = "student";
  } else if (scope.kind === "teacher") {
    if (
      borrowerId &&
      !idInObjectIdList(borrowerId, [
        ...scope.rosterStudentIds,
        scope.teacherDocId,
      ])
    ) {
      throw new ApiError(403, "You do not have access to these borrow records.");
    }
    if (borrowerId) {
      query.borrowerId =
        borrowerId === scope.teacherDocId.toString()
          ? scope.teacherDocId
          : new mongoose.Types.ObjectId(borrowerId);
      query.borrowerType =
        borrowerId === scope.teacherDocId.toString() ? "teacher" : "student";
    } else {
      const orClause: Record<string, unknown>[] = [
        {
          borrowerType: "teacher",
          borrowerId: scope.teacherDocId,
        },
      ];
      if (scope.rosterStudentIds.length > 0) {
        orClause.push({
          borrowerType: "student",
          borrowerId: { $in: scope.rosterStudentIds },
        });
      }
      query.$or = orClause;
    }
  } else {
    if (borrowerId) query.borrowerId = borrowerId;
  }

  const skip = (page - 1) * limit;

  const [borrows, total] = await Promise.all([
    BookBorrow.find(query)
      .populate("bookId", "title author isbn")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    BookBorrow.countDocuments(query),
  ]);

  return {
    borrows,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};
