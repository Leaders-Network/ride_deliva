console.log('Node.js is working');
console.log('Node version:', process.version);
console.log('Current directory:', process.cwd());

// Test if we can create an Express server without any imports
try {
  const express = require('express');
  const app = express();
  
  app.get('/', (req, res) => {
    res.json({ message: 'Simple test server working!' });
  });
  
  const server = app.listen(3000, () => {
    console.log('✅ Basic Express server started on port 3000');
    console.log('Visit: http://localhost:3000');
    
    // Close after 2 seconds for testing
    setTimeout(() => {
      server.close(() => {
        console.log('✅ Test completed successfully');
        process.exit(0);
      });
    }, 2000);
  });
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}