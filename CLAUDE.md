## Code Quality Standards

1. **File Headers**

   - Include comments at the top of every file explaining what it does
   - Format: `# filename.py - Brief description of purpose`

2. **Testing**

   - Add unit tests for every feature added
   - Tests should cover happy path and edge cases
   - Use pytest for Python, Jest for JavaScript

3. **Documentation**

   - Maintain PROJECT_CONTEXT.md after each session
   - Update CHANGELOG.md with:
     - Date
     - Changes made
     - Features added
     - Bugs fixed
     - What was tested

4. **Code Style**

   - Python: Follow PEP 8
   - JavaScript: Use modern ES6+ syntax
   - Add docstrings/comments for complex logic
   - Use meaningful variable names

5. **Error Handling**
   - Graceful failures with clear error messages
   - User-facing errors should be friendly
   - Technical errors logged for debugging

## Session Workflow

1. Read PROJECT_CONTEXT.md first
2. Implement requested features
3. Write tests
4. Update documentation
5. Summarize changes at end of session
