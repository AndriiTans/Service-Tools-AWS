# Handling Nested Routes Properly in CloudFront with Vite

This guide outlines the steps needed to properly handle nested routes in a CloudFront distribution when using a Vite-based React application.

## Steps

### 1. Configure Custom Error Pages in CloudFront
1. Open the **AWS Management Console** and navigate to your **CloudFront distribution**.
2. Go to the **Error pages** tab.
3. Add custom error responses for HTTP error codes:
   - **404**:
     - Set **Response page path** to `/index.html`.
     - Set **HTTP response code** to `200 OK`.
   - **403**:
     - Set **Response page path** to `/index.html`.
     - Set **HTTP response code** to `200 OK`.
4. Save the changes and deploy the updated CloudFront configuration.

### 2. Update Vite Configuration
1. Open the `vite.config.js` file in your project.
2. Update the `base` property in the Vite configuration to `'/'` for proper routing:
   ```javascript
   import { defineConfig } from 'vite';
   import react from '@vitejs/plugin-react';

   export default defineConfig({
     plugins: [react()],
     base: '/', // Ensure that the generated asset paths are absolute, which resolves the issue with broken paths on nested routes
     build: {
       rollupOptions: {
         output: {
           entryFileNames: 'assets/[name].js', // Stable entry file name
           chunkFileNames: 'assets/[name].js', // Stable chunk file names
           assetFileNames: 'assets/[name][extname]', // Stable asset file names
         },
       },
     },
   });
