import { Secret, verify } from "jsonwebtoken";
import { JwtData } from "../common/types/jwt.payload";
import { ReasonPhrases, StatusCodes } from "http-status-codes";

const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.cookies;

  if (!authHeader || !authHeader.__auth) {
    return res
      .status(StatusCodes.UNAUTHORIZED)
      .json({ message: ReasonPhrases.UNAUTHORIZED });
  }

  const token = authHeader.__auth;

  try {
    const decoded = verify(token, process.env.JWT_SECRET as Secret) as JwtData;

    (req as any).userId = decoded.userId;

    next();
  } catch (err) {
    return res
      .status(StatusCodes.UNAUTHORIZED)
      .json({ message: "Invalid or expired token" });
  }
};

export default authenticateToken;
