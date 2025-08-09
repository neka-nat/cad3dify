from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain.prompts import ChatPromptTemplate
from langchain_experimental.tools import PythonREPLTool

from .chat_models import MODEL_TYPE, ChatModelParameters

_INSTRUCTIONS = """You are an agent designed to execute and debug the given Python code.
Please make corrections so that the code runs successfully without changing the intended purpose of the given code.
`cadquery` is installed in the environment, so you can use it without setting it up.
Even if you can tell that no corrections are needed without executing it, you still need to run the code to confirm it works properly.
If it is difficult to make the code run successfully despite making corrections, respond with "I cannot fix it."

Working rules:
- Use tools to actually execute code. Prefer minimal edits.
- If execution fails, diagnose from the traceback, then propose a minimal fix and re-run.
- Never output large rewritten files inline; apply only the needed changes and re-run to verify.
"""


def execute_python_code(code: str, model_type: MODEL_TYPE = "gpt", only_execute: bool = False) -> str:
    """
    Execute the given Python `code`. If it fails, attempt to fix and re-run.
    Returns the final agent output message.
    """
    tools = [PythonREPLTool()]

    if only_execute:
        return tools[0].run(code)

    llm = ChatModelParameters.from_model_name(model_type).create_chat_model()

    agent = create_tool_calling_agent(llm, tools, ChatPromptTemplate.from_messages([
        ("system", _INSTRUCTIONS),
        ("user", "{input}"),
        ("placeholder", "{agent_scratchpad}"),
    ]))

    agent_executor = AgentExecutor(
        agent=agent,
        tools=tools,
        verbose=True,
        handle_parsing_errors=True,
        max_iterations=8,
    )

    user_input = (
        "Please execute the following code. If it doesn't work, fix the errors and make it run.\n"
        f"```python\n{code}\n```"
    )

    result = agent_executor.invoke({"input": user_input})
    return result["output"]
