import { useEffect, useState, type ImgHTMLAttributes } from "react";
import {
  responsiveCatalogueMedia,
  type CatalogueMediaProfile,
} from "@/lib/catalogueMedia";

type Props = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "src" | "srcSet" | "sizes"
> & {
  url: string;
  profile: CatalogueMediaProfile;
};

/** Keep the reserved image surface when delivery fails, without broken-image chrome. */
export default function CatalogueImage({
  url,
  profile,
  alt = "",
  onError,
  ...props
}: Props) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  if (failed)
    return (
      <span
        className="image-fallback"
        role="img"
        aria-label={alt ? `${alt}. Photo unavailable.` : "Photo unavailable"}
      >
        Photo unavailable
      </span>
    );
  return (
    <img
      {...responsiveCatalogueMedia(url, profile)}
      {...props}
      alt={alt}
      onError={event => {
        setFailed(true);
        onError?.(event);
      }}
    />
  );
}
