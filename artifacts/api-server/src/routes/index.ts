import { Router, type IRouter } from "express";
import healthRouter from "./health";
import storageRouter from "./storage";
import categoriesRouter from "./categories";
import listingsRouter from "./listings";
import meRouter from "./me";
import conversationsRouter from "./conversations";
import marketplaceRouter from "./marketplace";
import aiRouter from "./ai";
import moderationRouter from "./moderation";
import searchRouter from "./search";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storageRouter);
router.use(categoriesRouter);
router.use(listingsRouter);
router.use(meRouter);
router.use(conversationsRouter);
router.use(marketplaceRouter);
router.use(aiRouter);
router.use(moderationRouter);
router.use(searchRouter);

export default router;
