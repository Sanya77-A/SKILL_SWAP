import { Router } from "express";
import * as listing from "../controllers/listingController.js";
import { optionalAuth, protect } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import { createListingSchema, listingIdSchema, listListingsSchema, updateListingSchema } from "../validators/listing.js";

const router = Router();

router.get("/", validate(listListingsSchema), listing.listListings);
router.get("/mine", protect, listing.getMyListings);
router.post("/", protect, validate(createListingSchema), listing.createMyListing);
router.patch("/:id", protect, validate(updateListingSchema), listing.updateMyListing);
router.post("/:id/publish", protect, validate(listingIdSchema), listing.transitionMyListing("publish"));
router.post("/:id/pause", protect, validate(listingIdSchema), listing.transitionMyListing("pause"));
router.post("/:id/archive", protect, validate(listingIdSchema), listing.transitionMyListing("archive"));
router.get("/:id", optionalAuth, validate(listingIdSchema), listing.getListing);

export default router;
