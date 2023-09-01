export const DefaultBrowserErrorTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Error: {{statusCode}}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap');
    html, body
    {
    margin: 0;
    padding: 0;
    font-family: 'Poppins',sans-serif;
    font-size: 24px;
    color: #363636;
    }
    .error-container
    {
    min-height: 100vh;
    width: 100%;
    display: flex;
    flex-direction: column;
    }
    .error-box
    {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: row;
    }
    
    .error-code
    {
    font-weight: 600;
    font-size: 1.5rem;
    border-right: #A6A6A6 1px solid;
    }
    
    .error-message
    {
    white-space: pre-wrap;
    }
    
    .error-box > div
    {
    padding: 1.25rem;
    }
    
    .error-id
    {
    text-align: center;
    font-size: 0.5rem;
    padding: 1.25rem;
    opacity: 50%;
    }
    </style>
</head>
<body>
<div class="error-container">
    <div class="error-box">
        <div class="error-code">{{statusCode}}</div>
        <div>
            <div class="error-message">{{errorMessage}}</div>
        </div>
    </div>
    <div class="error-id">Request ID: {{requestID}}</div>
</div>
</body>
</html>`;
