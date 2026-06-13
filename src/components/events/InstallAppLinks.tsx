const APP_STORE_URL = "https://apps.apple.com/us/app/campus-xi/id6763406816";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.campusxi.app";

type InstallAppLinksProps = {
  className?: string;
  heading?: string;
  buttonClassName?: string;
  linkClassName?: string;
  includeHeading?: boolean;
};

export default function InstallAppLinks({
  className = "",
  heading,
  buttonClassName = "events-button events-button--full",
  linkClassName = "",
  includeHeading = false,
}: InstallAppLinksProps) {
  return (
    <section className={className}>
      {includeHeading && heading ? <p className="eyebrow">{heading}</p> : null}
      <div className="inline-links">
        <a
          className={linkClassName || buttonClassName}
          href={APP_STORE_URL}
          target="_blank"
          rel="noreferrer"
        >
          Download on App Store
        </a>
        <a
          className={linkClassName || buttonClassName}
          href={PLAY_STORE_URL}
          target="_blank"
          rel="noreferrer"
        >
          Get it on Google Play
        </a>
      </div>
    </section>
  );
}
