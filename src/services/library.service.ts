import mongoose from "mongoose";
import Book from "../models/Book.model.js";
import type { IBook } from "../models/Book.model.js";
import BookBorrow from "../models/BookBorrow.model.js";
import Student from "../models/Student.model.js";
import Teacher from "../models/Teacher.model.js";
import type { IUserDocument } from "../models/User.model.js";
import type { SchoolReadScope } from "../types/schoolReadScope.js";
import ApiError from "../utils/ApiError.js";
import {
  assertSchoolDataAccess,
  assertSchoolMutationAllowed,
  idInObjectIdList,
} from "../utils/schoolReadAccess.js";

function requireObjectId(id: string): void {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "A valid id is required");
  }
}

function duplicateIsbn(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === 11000);
}

export const createBookService = async (
  data: Partial<IBook>,
  actor: IUserDocument,
) => {
  assertSchoolMutationAllowed(actor);
  if (!data.title || !data.author || !data.category || data.totalCopies === undefined || data.availableCopies === undefined) {
    throw new ApiError(400, "Book is missing required fields");
  }

  try {
    return await Book.create({
      title: data.title,
      author: data.author,
      ...(data.isbn ? { isbn: data.isbn } : {}),
      category: data.category,
      totalCopies: data.totalCopies,
      availableCopies: data.availableCopies,
      ...(data.description ? { description: data.description } : {}),
      ...(data.publishedYear !== undefined ? { publishedYear: data.publishedYear } : {}),
      ...(data.status ? { status: data.status } : {}),
    });
  } catch (error) {
    if (duplicateIsbn(error)) {
      throw new ApiError(400, "A book with this ISBN already exists");
    }
    throw error;
  }
};

export const getAllBooksService = async (
  filters: {
    category?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  },
  scope: SchoolReadScope,
) => {
  assertSchoolDataAccess(scope);
  const { category, status, search, page = 1, limit = 20 } = filters;

  const query: any = {};

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

export const getBookByIdService = async (id: string, scope: SchoolReadScope) => {
  assertSchoolDataAccess(scope);
  requireObjectId(id);
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
  requireObjectId(id);

  try {
    const book = await Book.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    });

    if (!book) {
      throw new ApiError(404, "Book not found");
    }

    return book;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (duplicateIsbn(error)) {
      throw new ApiError(400, "A book with this ISBN already exists");
    }
    throw error;
  }
};

export const deleteBookService = async (
  id: string,
  actor: IUserDocument,
) => {
  assertSchoolMutationAllowed(actor);
  requireObjectId(id);

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
  requireObjectId(bookId);
  requireObjectId(data.borrowerId);

  if (data.borrowerType === "student") {
    const student = await Student.findById(data.borrowerId).select("_id");
    if (!student) throw new ApiError(404, "Student not found");
  } else {
    const teacher = await Teacher.findById(data.borrowerId).select("_id");
    if (!teacher) throw new ApiError(404, "Teacher not found");
  }

  const book = await Book.findById(bookId);

  if (!book) {
    throw new ApiError(404, "Book not found");
  }

  if (book.availableCopies <= 0) {
    throw new ApiError(400, "No copies available for borrowing");
  }

  const activeBorrow = await BookBorrow.findOne({
    bookId,
    borrowerId: data.borrowerId,
    status: "borrowed",
  } as any);

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
  requireObjectId(borrowId);

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
  if (borrowerId) requireObjectId(borrowerId);
  if (bookId) requireObjectId(bookId);

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
      .sort({ createdAt: -1 })
      .lean(),
    BookBorrow.countDocuments(query),
  ]);

  const studentIds = borrows
    .filter((borrow) => borrow.borrowerType === "student")
    .map((borrow) => borrow.borrowerId);
  const teacherIds = borrows
    .filter((borrow) => borrow.borrowerType === "teacher")
    .map((borrow) => borrow.borrowerId);
  const [students, teachers] = await Promise.all([
    studentIds.length
      ? Student.find({ _id: { $in: studentIds } }).select("firstName lastName studentId").lean()
      : [],
    teacherIds.length
      ? Teacher.find({ _id: { $in: teacherIds } }).select("firstName lastName teacherId").lean()
      : [],
  ]);
  const studentById = new Map(students.map((student) => [student._id.toString(), student]));
  const teacherById = new Map(teachers.map((teacher) => [teacher._id.toString(), teacher]));

  return {
    borrows: borrows.map((borrow) => {
      const borrowerKey = borrow.borrowerId.toString();
      const borrower =
        borrow.borrowerType === "student" ? studentById.get(borrowerKey) : teacherById.get(borrowerKey);
      return {
        ...borrow,
        borrowerId: borrower ?? borrow.borrowerId,
      };
    }),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};