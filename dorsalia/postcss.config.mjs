/**
 * Config propio (aunque vacío) para que Next no herede el postcss.config del
 * repo raíz (Notifikado usa Tailwind; Dorsalia usa CSS plano).
 * @type {import('postcss-load-config').Config}
 */
const config = {
  plugins: {},
};

export default config;
