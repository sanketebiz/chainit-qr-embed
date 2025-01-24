(function () {
  // Get the current script element
  const script = document.currentScript;

  // Extract the `src` attribute
  const scriptSrc = script.src;

  // Parse the query parameters using the URL API
  const urlParams = new URL(scriptSrc).searchParams;

  // Get individual parameters
  const apiKey = urlParams.get('apiKey');
  const successURL = urlParams.get('successURL');
  const failureURL = urlParams.get('failureURL');
  const notificationURL = urlParams.get('notificationURL');

  // Example usage
  console.log('API Key:', apiKey);
  console.log('Success URL:', successURL);
  console.log('Failure URL:', failureURL);
  console.log('Notification URL:', notificationURL);

  // Your code to use these parameters, e.g., initialize a QR code generator
})();