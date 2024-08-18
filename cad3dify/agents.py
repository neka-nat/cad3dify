from langchain import hub
from langchain.agents import AgentExecutor, create_react_agent
from langchain_experimental.tools import PythonREPLTool
from langchain_openai import ChatOpenAI

_instructions = """You are an agent designed to execute and debug the given Python code.
Please make corrections so that the code runs successfully without changing the intended purpose of the given code.
`cadquery` is installed in the environment, so you can use it without setting it up.
Even if you can tell that no corrections are needed without executing it, you still need to run the code to confirm it works properly.
If it is difficult to make the code run successfully despite making corrections, respond with "I cannot fix it."
"""


def execute_python_code(code: str, only_execute: bool = False) -> str:
    tools = [PythonREPLTool()]
    if only_execute:
        return tools[0].run(code)
    base_prompt = hub.pull("langchain-ai/react-agent-template")
    prompt = base_prompt.partial(instructions=_instructions)
    agent = create_react_agent(
        ChatOpenAI(model="gpt-4o-2024-08-06", temperature=0.0, max_tokens=16384),
        tools=tools,
        prompt=prompt,
    )
    agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True)
    output = agent_executor.invoke(
        {
            "input": f"Please execute the following code. If it doesn't work, fix the errors and make it run.\n```python\n{code}\n```\n"
        }
    )["output"]
    return output
