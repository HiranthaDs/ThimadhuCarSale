export default function Footer() {
  return (
    <div className="tp-footer">
      <div>
        <span className="tp-brand-inline">Thimadu Auto Trading</span> © {new Date().getFullYear()}. All rights reserved.
      </div>
      <div className="tp-footer-links">
        <a href="#">Privacy</a>
        <a href="#">Terms</a>
        <a href="#">Help</a>
      </div>
    </div>
  )
}
