RENAME TABLE `product_colors` TO `colors`;--> statement-breakpoint
ALTER TABLE `variants` DROP FOREIGN KEY `variants_colorId_product_colors_id_fk`;--> statement-breakpoint
ALTER TABLE `colors` DROP FOREIGN KEY `product_colors_productId_products_id_fk`;--> statement-breakpoint
ALTER TABLE `colors` DROP INDEX `product_colors_product_key_unique`;--> statement-breakpoint
DROP INDEX `product_colors_product_id_idx` ON `colors`;--> statement-breakpoint
ALTER TABLE `colors` ADD CONSTRAINT `colors_normalized_key_unique` UNIQUE(`normalizedKey`);--> statement-breakpoint
ALTER TABLE `colors` DROP COLUMN `productId`;--> statement-breakpoint
ALTER TABLE `variants` ADD CONSTRAINT `variants_colorId_colors_id_fk` FOREIGN KEY (`colorId`) REFERENCES `colors`(`id`) ON DELETE set null ON UPDATE no action;
