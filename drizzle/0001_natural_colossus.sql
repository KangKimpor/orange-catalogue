CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(64) NOT NULL,
	`label` varchar(128) NOT NULL,
	`sortOrder` int NOT NULL,
	`isVisible` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `import_changes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`importId` int NOT NULL,
	`productId` int,
	`variantId` int,
	`posCode` varchar(255),
	`changeType` enum('new_product','new_variant','stock_price_update','missing_from_import','needs_review') NOT NULL,
	`beforeJson` json,
	`afterJson` json,
	`reviewStatus` enum('pending','accepted','ignored') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `import_changes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `imports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`originalFilename` varchar(255) NOT NULL,
	`digest` varchar(128) NOT NULL,
	`status` enum('preview','applied','failed','rolled_back') NOT NULL,
	`parsedRows` int NOT NULL DEFAULT 0,
	`summaryJson` json,
	`validationJson` json,
	`appliedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `imports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_colors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`khmerName` varchar(128),
	`englishName` varchar(128) NOT NULL,
	`hex` varchar(16) NOT NULL,
	`normalizedKey` varchar(160) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_colors_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_colors_product_key_unique` UNIQUE(`productId`,`normalizedKey`)
);
--> statement-breakpoint
CREATE TABLE `product_media` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`variantId` int,
	`cloudinaryPublicId` varchar(500) NOT NULL,
	`optimizedUrl` text NOT NULL,
	`altText` varchar(255),
	`colorTag` varchar(128),
	`sortOrder` int NOT NULL DEFAULT 0,
	`isPrimary` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_media_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_media_public_id_unique` UNIQUE(`cloudinaryPublicId`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(160) NOT NULL,
	`cleanedCode` varchar(255) NOT NULL,
	`displayName` varchar(255),
	`categoryId` int,
	`categorySource` enum('rule','manual','unassigned') NOT NULL DEFAULT 'unassigned',
	`isPublished` boolean NOT NULL DEFAULT true,
	`isRemovedFromLatestImport` boolean NOT NULL DEFAULT false,
	`reviewStatus` enum('clean','needs_review','archived') NOT NULL DEFAULT 'clean',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_slug_unique` UNIQUE(`slug`),
	CONSTRAINT `products_cleaned_code_unique` UNIQUE(`cleanedCode`)
);
--> statement-breakpoint
CREATE TABLE `store_settings` (
	`key` varchar(128) NOT NULL,
	`value` text NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `store_settings_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `variants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`colorId` int,
	`posCode` varchar(255) NOT NULL,
	`size` varchar(64),
	`price` decimal(10,2) NOT NULL,
	`stockQuantity` int NOT NULL,
	`isVisible` boolean NOT NULL DEFAULT true,
	`lastSeenImportId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `variants_id` PRIMARY KEY(`id`),
	CONSTRAINT `variants_pos_code_unique` UNIQUE(`posCode`)
);
--> statement-breakpoint
ALTER TABLE `import_changes` ADD CONSTRAINT `import_changes_importId_imports_id_fk` FOREIGN KEY (`importId`) REFERENCES `imports`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `import_changes` ADD CONSTRAINT `import_changes_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `import_changes` ADD CONSTRAINT `import_changes_variantId_variants_id_fk` FOREIGN KEY (`variantId`) REFERENCES `variants`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_colors` ADD CONSTRAINT `product_colors_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_media` ADD CONSTRAINT `product_media_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_media` ADD CONSTRAINT `product_media_variantId_variants_id_fk` FOREIGN KEY (`variantId`) REFERENCES `variants`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_categoryId_categories_id_fk` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `variants` ADD CONSTRAINT `variants_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `variants` ADD CONSTRAINT `variants_colorId_product_colors_id_fk` FOREIGN KEY (`colorId`) REFERENCES `product_colors`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `import_changes_import_id_idx` ON `import_changes` (`importId`);--> statement-breakpoint
CREATE INDEX `product_colors_product_id_idx` ON `product_colors` (`productId`);--> statement-breakpoint
CREATE INDEX `product_media_product_id_idx` ON `product_media` (`productId`);--> statement-breakpoint
CREATE INDEX `product_media_variant_id_idx` ON `product_media` (`variantId`);--> statement-breakpoint
CREATE INDEX `products_category_id_idx` ON `products` (`categoryId`);--> statement-breakpoint
CREATE INDEX `variants_product_id_idx` ON `variants` (`productId`);--> statement-breakpoint
CREATE INDEX `variants_color_id_idx` ON `variants` (`colorId`);