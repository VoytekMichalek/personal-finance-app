FROM node:24.21.0-alpine3.24 AS toolchain
RUN apk upgrade --no-cache && apk add --no-cache openssl ca-certificates poppler-utils tesseract-ocr tesseract-ocr-data-eng
RUN npm install --global pnpm@10.34.6
WORKDIR /app

FROM toolchain AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm db:generate && pnpm build
ARG APP_VERSION=development
ARG RELEASE_TAG=unreleased
ARG BUILD_COMMIT=working-tree
RUN node scripts/build-metadata.mjs "$APP_VERSION" "$RELEASE_TAG" "$BUILD_COMMIT"
RUN pnpm --filter @finance/api deploy --prod --legacy /runtime/api
RUN cd /runtime/api && ./node_modules/.bin/prisma generate

FROM node:24.21.0-alpine3.24 AS production
RUN apk upgrade --no-cache && apk add --no-cache openssl ca-certificates poppler-utils tesseract-ocr tesseract-ocr-data-eng
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
WORKDIR /app
COPY --from=build --chown=node:node /runtime/api apps/api
COPY --from=build --chown=node:node /app/apps/web/dist apps/web/dist
COPY --from=build --chown=node:node /app/docs/user-guide docs/user-guide
COPY --from=build --chown=node:node /app/build-metadata.json build-metadata.json
COPY --chown=node:node scripts/container-entrypoint.sh /app/entrypoint.sh
ENV NODE_ENV=production
USER node
EXPOSE 3000
HEALTHCHECK --interval=20s --timeout=3s --start-period=20s CMD node -e "fetch('http://127.0.0.1:3000/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
ENTRYPOINT ["/app/entrypoint.sh"]
