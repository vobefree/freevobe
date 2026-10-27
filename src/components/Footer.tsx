/** Subtil sidfot – varumärkesraden och (på anställdsidor) en diskret länk till administrationen. */
export default function Footer({ adminLink = false }: { adminLink?: boolean }) {
  return (
    <footer className="site-footer">
      <span>Forshems Gästgiveri – anno 1564</span>
      {adminLink ? (
        <>
          <span className="site-footer-dot" aria-hidden>
            ·
          </span>
          <a href="/?admin=1">Administration</a>
        </>
      ) : null}
    </footer>
  );
}
