(function () {
  const callbackModule = (function () {
    let _qrContainer = null;
    let _generateQRCode = null;
    let _successRedirectURL = null;
    let _failRedirectURL = null;
    const STATES = {
      WaitingForScan: "WaitingForScan",
      Timeout: "Timeout",
      Scanned: "Scanned",
      Approved: "Approved",
      RejectedByUser: "RejectedByUser",
      RejectedByRequirement: "RejectedByRequirement",
    };
    function setOptions(options) {
      if (options.qrCodeSelector) {
        _qrContainer = document.querySelector(options.qrCodeSelector);
      } else {
        console.error("Not Valid Selector");
      }
      if (options.generateQRCodeFunction) {
        _generateQRCode = options.generateQRCodeFunction;
      }
      if (options.successRedirectURL) {
        _successRedirectURL = options.successRedirectURL;
      }
      if (options.failRedirectURL) {
        _failRedirectURL = options.failRedirectURL;
      }
    }
    const REDIRECT_DELAY = 10000;
    const MESSAGES = {
      [STATES.Timeout]: `<div class='message'>QR code expired.</div><a href='#' id='new-qr-button' class='button secondary'>New QR</a>`,
      [STATES.Scanned]: `<div class='spinner'></div><div class='message'>Scanning in progress...</div>`,
      [STATES.Approved]: `<div class='checkmark'></div><div class='message w-100'>CHAIN<span class='green-text'>IT</span> ID</div><div class='label w-100'>Your age was validated. You will gain access in 10 seconds</div>`,
      [STATES.RejectedByUser]: `<div class='cross'></div><div class='message denied'>Access Denied</div>`,
      [STATES.RejectedByRequirement]: `<div class='cross'></div><div class='message denied'>Access Denied</div>`,
    };
    function redirectWithDelay(url, delay) {
      setTimeout(() => {
        window.location.href = url;
      }, delay);
    }
    function _handleState(data) {
      const message = MESSAGES[data];
      if (message) {
        let html = `<div class='w-100 h-100 align-content-center'>${message}</div>`;
        _qrContainer.innerHTML = "";
        switch (data) {
          case STATES.Timeout:
            _qrContainer.innerHTML = html;
            document
              .getElementById("new-qr-button")
              .addEventListener("click", _generateQRCode);
            break;
          case STATES.Scanned:
            _qrContainer.innerHTML = html;
            break;
          case STATES.Approved:
            _qrContainer.innerHTML = html;
            if (_successRedirectURL) {
              redirectWithDelay(_successRedirectURL, REDIRECT_DELAY);
            }
            break;
          case STATES.RejectedByUser:
          case STATES.RejectedByRequirement:
            _qrContainer.innerHTML = html;
            if (_failRedirectURL) {
              redirectWithDelay(_failRedirectURL, REDIRECT_DELAY);
            }
            break;
          default:
            _qrContainer.innerHTML = `<p>Unknown state: ${data}</p>`;
            break;
        }
      }
    }
    return {
      _handleState,
      STATES,
      setOptions,
    };
  })();
  window.callbackModule = callbackModule;

  //DOCUMENTATION
  /*
  REQUIRED CONFIGURATION PROPS (KEY: TYPE - DESCRIPTION)
  apiKey: string - used to generate the qr code.
  qrContainerSelector: string - selector to display QR code.
  logContainerSelector: string - selector to display logs [OPTIONAL].
  onVerificationSuccess: function - callback function to perform actions after a success verification
  onVerificationFailure: function - callback function to perform actions after a failure in endepoint call
  onVerificationScanning: function - callback function to perform actions when QR code is being scanned
  onVerificationRejectedByUser: function - callback function to perform actions after the user is rejected by user permissions
  onVerificationRejectedByRequirements: function - callback function to perform actions after user is rejected by requirements in host rules
  onVerificationTimeout: function - callback function to perform actions after qr code timeout expires
  */
  /*
  OPTIONS TEMPLATE
  options = {
  apiKey: 'HERE_YOUR API_KEY',
  qrContainerSelector: 'HERE_SELECTOR_FOR_QR_CONTAINER',
  logContainerSelector: 'HERE_SELECTOR_FOR_LOG_CONTAINER',
  onVerificationSuccess: 'HERE_ON_SUCCESS_FUNCTION',
  onVerificationFailure: 'HERE_ON_FAILURE_FUNCTION',
  onVerificationScanning: 'HERE_ON_SCANNNING_FUNCTION',
  onVerificationRejectedByUser: 'HERE_ON_REJECTCTION_BY_USER_FUNCTION',
  onVerificationRejectedByRequirements: 'HERE_ON_REJECTION_BY_REQUIREMENTS_FUNCTION',
  onVerificationTimeout: 'HERE_ON_QR_TIMEOUT_FUNCTION'
  };
  */
  const ageVerificationModule = (function () {
    const DEFAULT_HEADERS = {
      "Content-Type": "application/json",
    };
    const POLLING_INTERVAL_IN_MS = 10_000;
    const API_KEY_HEADER_NAME = "x-api-key";
    const REQUEST_METHODS = {
      POST: "POST",
      GET: "GET",
    };
    const DEFAULT_API_BASE_URL =
      "https://api.chainit.online";
    const GENERATE_QR_CODE_ENDPOINT = "/users/v1/age-verification";
    const STATES = {
      WaitingForScan: "WaitingForScan",
      Timeout: "Timeout",
      Scanned: "Scanned",
      Approved: "Approved",
      RejectedByUser: "RejectedByUser",
      RejectedByRequirement: "RejectedByRequirement",
    };
    //Used to cancel the polling after a new Qr code is generated
    let pollingIntervalId = null;
    //OPTIONS
    let _apiKey = null;
    let _qrContainerSelector = null;
    let _qrContainer = null;
    let _logContainer = null;
    let _apiBaseUrl = DEFAULT_API_BASE_URL;
    let _onVerificationSuccessCallback = null;
    let _onVerificationFailureCallback = null;
    let _onVerificationScanningCallback = null;
    let _onVerificationRejectedByUserCallback = null;
    let _onVerificationRejectedByRequirementsCallback = null;
    let _onVerificationTimeoutCallback = null;
    const _sendRequest = (url, method, body, extraHeaders = []) => {
      const requestData = {
        method: method,
        headers: {
          ...DEFAULT_HEADERS,
          ...extraHeaders,
        },
      };
      if (method === REQUEST_METHODS.POST) {
        requestData.body = JSON.stringify(body);
      }
      return fetch(url, requestData)
        .then((response) => response.json())
        .then((data) => {
          _logFetchedData(url, method, body, data);
          return data;
        })
        .catch((error) => {
          console.error(error);
        });
    };
    const _validateOptions = (options) => {
      if (!options.apiKey) {
        throw new Error("apiKey is required");
      }
      if (!options.qrContainerSelector) {
        throw new Error("qrContainerSelector is required");
      }
      if (!options.onVerificationSuccess) {
        throw new Error("onVerificationSuccess is required");
      }
      if (!options.onVerificationFailure) {
        throw new Error("onVerificationFailure is required");
      }
      if (!options.onVerificationScanning) {
        throw new Error("onVerificationScanning is required");
      }
      if (!options.onVerificationRejectedByUser) {
        throw new Error("onVerificationRejectedByUser is required");
      }
      if (!options.onVerificationRejectedByRequirements) {
        throw new Error("onVerificationRejectedByRequirements is required");
      }
      if (!options.onVerificationTimeout) {
        throw new Error("onVerificationTimeout is required");
      }
      //Check if Selector matches a valid element
      _qrContainer = document.querySelector(options.qrContainerSelector);
      if (!_qrContainer) {
        throw new Error("qrContainerSelector is invalid");
      }
    };
    const _initializeVariables = (options) => {
      _apiKey = options.apiKey;
      _onVerificationSuccessCallback = options.onVerificationSuccess;
      _onVerificationFailureCallback = options.onVerificationFailure;
      _onVerificationScanningCallback = options.onVerificationScanning;
      _onVerificationRejectedByUserCallback =
        options.onVerificationRejectedByUser;
      _onVerificationRejectedByRequirementsCallback =
        options.onVerificationRejectedByRequirements;
      _onVerificationTimeoutCallback = options.onVerificationTimeout;
      _qrContainerSelector = options.qrContainerSelector;
      _qrContainer = document.querySelector(options.qrContainerSelector);
      _logContainer = document.querySelector(options.logContainerSelector);
      if (options.apiBaseUrl) {
        _apiBaseUrl = options.apiBaseUrl;
      }
    };
    const _ensureConfigured = () => {
      if (!_apiKey || !_qrContainerSelector) {
        throw new Error("You must call configure() before calling this method");
      }
    };
    const _displayQrCode = (qrCodeUrl, deepUrl) => {
      const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(
        navigator.userAgent
      );
      const qrCodeHtml = `
          <div class="w-100 h-100" id="qr-code" style="cursor:pointer; text-align: center;">
              <img src="${qrCodeUrl}" style="width:100%;height:100%;" alt="Age Verification QR Code" />
          </div>
      `;
      _qrContainer.innerHTML = qrCodeHtml;
      document.getElementById("qr-code").addEventListener("click", () => {
        window.open(deepUrl, "_blank");
      });
    };
    const _logFetchedData = (url, method, body, data) => {
      if (_logContainer) {
        const formatData = (data, depth = 0) => {
          const indent = "&nbsp;".repeat(depth * 4);
          return Object.entries(data)
            .map(([key, value]) => {
              if (typeof value === "object" && value !== null) {
                return `${indent}${key}: {<br>${formatData(
                  value,
                  depth + 1
                ).replace(/\n/g, "<br>")}<br>${indent}}`;
              } else {
                return `${indent}${key}: ${value}`;
              }
            })
            .join("<br>");
        };
        const filteredData = Object.keys(data)
          .filter((key) => key === "scanningState" || key === "userInfo")
          .reduce((obj, key) => {
            obj[key] = data[key];
            return obj;
          }, {});
        const formattedData = formatData(filteredData);
        const logEntry = document.createElement("div");
        logEntry.innerHTML = `${formattedData}<br><br>`;
        _logContainer.prepend(logEntry);
      }
    };
    const _buildUrl = (endpoint) => {
      return `${_apiBaseUrl}${endpoint}`;
    };
    const configure = (options) => {
      _validateOptions(options);
      _initializeVariables(options);
    };
    const _cancelCurrentPolling = () => {
      //if a polling is active, cancel the previous interval
      if (pollingIntervalId) {
        clearInterval(pollingIntervalId);
      }
    };
    const _handleState = (data) => {
      if (data === STATES.WaitingForScan) {
        return;
      } else if (data === STATES.Approved && _onVerificationSuccessCallback) {
        _onVerificationSuccessCallback();
      } else if (data === STATES.Scanned && _onVerificationScanningCallback) {
        _onVerificationScanningCallback();
        return;
      } else if (
        data === STATES.RejectedByUser &&
        _onVerificationRejectedByUserCallback
      ) {
        _onVerificationRejectedByUserCallback();
      } else if (
        data === STATES.RejectedByRequirement &&
        _onVerificationRejectedByRequirementsCallback
      ) {
        _onVerificationRejectedByRequirementsCallback();
      } else if (data === STATES.Timeout && _onVerificationTimeoutCallback) {
        _onVerificationTimeoutCallback();
      } else {
        _onVerificationFailureCallback();
      }
      _cancelCurrentPolling();
    };
    const _startPolling = (pollingUrl) => {
      _cancelCurrentPolling();
      pollingIntervalId = setInterval(async () => {
        _ensureConfigured();
        await _sendRequest(
          pollingUrl,
          REQUEST_METHODS.GET,
          {},
          {
            [API_KEY_HEADER_NAME]: _apiKey,
          }
        )
          .then((data) => {
            console.log(data);
            if (data && data.scanningState) {
              _handleState(data.scanningState);
            } else if (data && data.error) {
              _handleState("");
            }
          })
          .catch((error) => {
            _handleState("");
            throw error;
          });
      }, POLLING_INTERVAL_IN_MS);
    };
    const generateQRCode = () => {
      _ensureConfigured();
      _sendRequest(
        `${_buildUrl(GENERATE_QR_CODE_ENDPOINT)}`,
        REQUEST_METHODS.POST,
        {},
        { [API_KEY_HEADER_NAME]: _apiKey }
      ).then((data) => {
        _displayQrCode(data.qrCodeUrl, data.deepLink);
        _startPolling(data.qrCodeStatusCheckUrl);
      });
    };
    return {
      configure,
      generateQRCode,
    };
  })();
  window.bitAgeVerification = ageVerificationModule;

  const extractQueryParams = () => {
    const script = document.currentScript;

    // Extract the `src` attribute
    const scriptSrc = script.src;

    // Parse the query parameters using the URL API
    const urlParams = new URL(scriptSrc).searchParams;

    return {
      apiKey: urlParams.get("apiKey"),
      successURL: urlParams.get("successURL"),
      failureURL: urlParams.get("failureURL"),
      notificationURL: urlParams.get("notificationURL"),
    };
  };

  const queryParams = extractQueryParams();

  console.log({ queryParams });

  if (!queryParams.apiKey) {
    console.log(
      "apiKey is required paramater to generate the QR code, please make sure it is passed in the parameters"
    );
    return;
  }

  try {
    window.bitAgeVerification.configure({
      apiKey: queryParams.apiKey,
      qrContainerSelector: "#bit-age-verification-qr",
      logContainerSelector: "#bit-age-verification-logs",
      onVerificationSuccess: function () {
        console.log("Verification success");
        window.callbackModule._handleState(window.callbackModule.STATES.Approved);
      },
      onVerificationFailure: function () {
        window.callbackModule._handleState(window.callbackModule.STATES.Timeout);
        console.log("Verification failure");
      },
      onVerificationScanning: function () {
        console.log("Scanning QR code");
        window.callbackModule._handleState(window.callbackModule.STATES.Scanned);
      },
      onVerificationRejectedByUser: function () {
        console.log("Rejected by User");
        window.callbackModule._handleState(
          window.callbackModule.STATES.RejectedByUser
        );
      },
      onVerificationRejectedByRequirements: function () {
        console.log("Rejected by Requirements");
        window.callbackModule._handleState(
          window.callbackModule.STATES.RejectedByRequirement
        );
      },
      onVerificationTimeout: function () {
        console.log("QR expired, generate a new QR code");
        window.callbackModule._handleState(window.callbackModule.STATES.Timeout);
      },
    });

    window.bitAgeVerification.generateQRCode();
    window.callbackModule.setOptions({
      qrCodeSelector: "#bit-age-verification-qr",
      generateQRCodeFunction: () => window.bitAgeVerification.generateQRCode(),
      successRedirectURL: queryParams.successURL,
      failRedirectURL: queryParams.failureURL,
    });
  } catch (e) {
    console.log(e)
  }
})();
